"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LogOut, Sparkles, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";

import axiosInstance from "@/utils/axios";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";

import { DebugTable } from "@/components/dashboard/DebugTable";
import UploadCard from "./components/UploadCard";
import JobsHistory from "./components/JobsHistory";
import ResultsSection from "./components/ResultsSection";
import DetailsModal from "./components/DetailsModal";

const MAX_MB = 25;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const PAGE_SIZE_STORAGE_KEY = "dashboard:page-size";
const LIVE_PREVIEW_STATUSES = new Set(["queued", "processing", "done"]);

const readPreviewFromFile = (targetFile) =>
    new Promise((resolve) => {
        try {
            const reader = new FileReader();
            reader.onload = (event) => {
                const raw = String(event?.target?.result || "");
                const lines = raw
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .slice(0, 6);

                const parsed = lines.map((line) =>
                    line
                        .split(",")
                        .map((cell) => cell.trim().replace(/^"|"$/g, ""))
                );

                resolve(parsed);
            };
            reader.onerror = () => resolve([]);
            reader.readAsText(targetFile.slice(0, 12000));
        } catch {
            resolve([]);
        }
    });

export default function Page() {
    const router = useRouter();
    const { ready, isLoggedIn } = useAuth();

    const [file, setFile] = useState(null);
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [jobError, setJobError] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const [jobs, setJobs] = useState([]);

    const [headers, setHeaders] = useState([]);
    const [rows, setRows] = useState([]);
    const [totalRows, setTotalRows] = useState(0);

    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);

    const [jobRows, setJobRows] = useState(0);
    const [jobCols, setJobCols] = useState(0);
    const [processedRows, setProcessedRows] = useState(0);
    const [durationMs, setDurationMs] = useState(0);

    const [csvPreviewRows, setCsvPreviewRows] = useState([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState(null);

    const pollRef = useRef(null);

    const [elapsedSec, setElapsedSec] = useState(0);
    const timerRef = useRef(null);
    const startMsRef = useRef(null);
    const previewPageRef = useRef(page);
    const previewPageSizeRef = useRef(pageSize);
    const previewQueryRef = useRef(debouncedQuery);
    const previewTickRef = useRef(0);

    const isProcessing = jobStatus === "queued" || jobStatus === "processing";

    const openModal = useCallback((data) => {
        setModalData(data);
        setIsModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setModalData(null);
    }, []);

    useEffect(() => {
        if (!ready) return;
        if (!isLoggedIn) router.replace("/login");
    }, [ready, isLoggedIn, router]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
        if (stored && [10, 25, 50, 100, 200].includes(stored)) {
            setPageSize(stored);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
    }, [pageSize]);

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 350);
        return () => clearTimeout(timeout);
    }, [query]);

    useEffect(() => {
        previewPageRef.current = page;
    }, [page]);

    useEffect(() => {
        previewPageSizeRef.current = pageSize;
    }, [pageSize]);

    useEffect(() => {
        previewQueryRef.current = debouncedQuery;
    }, [debouncedQuery]);

    const validateFile = useCallback((nextFile) => {
        if (!nextFile) return "No file selected";
        const nameOk = (nextFile.name || "").toLowerCase().endsWith(".csv");
        if (!nameOk) return "Only .csv files are allowed";
        if (nextFile.size === 0) return "File is empty";
        if (nextFile.size > MAX_BYTES) return `File is too large. Max ${MAX_MB}MB`;
        return null;
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        startMsRef.current = null;
    }, []);

    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!startMsRef.current) startMsRef.current = Date.now();

        timerRef.current = setInterval(() => {
            if (!startMsRef.current) return;
            setElapsedSec(Math.floor((Date.now() - startMsRef.current) / 1000));
        }, 1000);
    }, []);

    useEffect(() => {
        if (isProcessing) startTimer();
        else stopTimer();
    }, [isProcessing, startTimer, stopTimer]);

    useEffect(
        () => () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            stopTimer();
        },
        [stopTimer]
    );

    const resetAll = useCallback(() => {
        setFile(null);
        setJobId(null);
        setJobStatus(null);
        setJobError("");
        setIsUploading(false);

        setHeaders([]);
        setRows([]);
        setTotalRows(0);

        setQuery("");
        setDebouncedQuery("");
        setPage(1);

        setJobRows(0);
        setJobCols(0);
        setProcessedRows(0);
        setDurationMs(0);
        setCsvPreviewRows([]);

        setIsModalOpen(false);
        setModalData(null);

        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }

        stopTimer();
        setElapsedSec(0);
    }, [stopTimer]);

    const onDrop = useCallback(
        async (acceptedFiles, rejections) => {
            setJobError("");

            if (rejections?.length) {
                const message = rejections[0]?.errors?.[0]?.message || "File rejected";
                setJobError(message);
                toast.error(message);
                return;
            }

            const nextFile = acceptedFiles?.[0];
            const err = validateFile(nextFile);
            if (err) {
                setJobError(err);
                toast.error(err);
                return;
            }

            setFile(nextFile);
            const previewRows = await readPreviewFromFile(nextFile);
            setCsvPreviewRows(previewRows);
            toast.success("File ready for preview");
        },
        [validateFile]
    );

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: { "text/csv": [".csv"] },
        maxFiles: 1,
        multiple: false,
        noClick: true,
        noKeyboard: true,
    });

    const loadJobs = useCallback(async () => {
        try {
            const res = await axiosInstance.get("/csv-vehicle/jobs");
            const nextJobs = Array.isArray(res.data) ? res.data : [];
            const toTs = (job) => {
                const candidate = job?.created_at || job?.createdAt || job?.updated_at || job?.started_at || job?.finished_at;
                const ts = Date.parse(String(candidate || ""));
                return Number.isFinite(ts) ? ts : 0;
            };

            const sorted = [...nextJobs].sort((a, b) => {
                const tsDiff = toTs(b) - toTs(a);
                if (tsDiff !== 0) return tsDiff;
                return String(b?.job_id || "").localeCompare(String(a?.job_id || ""));
            });

            setJobs(sorted);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (!ready || !isLoggedIn) return;
        loadJobs();
    }, [ready, isLoggedIn, loadJobs]);

    const fetchJobMeta = useCallback(async (id) => {
        const res = await axiosInstance.get(`/csv-vehicle/jobs/${id}`);
        const data = res.data || {};
        const status = String(data.status || "").toLowerCase() || null;

        setJobId(data.job_id || id);
        setJobStatus(status);
        setJobError(data.error || "");
        setJobRows(data.rows || 0);
        setJobCols(data.columns || 0);
        setProcessedRows(data.processed_rows || 0);
        setDurationMs(data.duration_ms || 0);

        return data;
    }, []);

    const fetchPreviewPage = useCallback(async (id, nextPage, nextPageSize, nextQuery) => {
        const res = await axiosInstance.get(`/csv-vehicle/jobs/${id}/preview`, {
            params: { page: nextPage, page_size: nextPageSize, query: nextQuery || "" },
        });

        const data = res.data || {};
        const nextHeaders = Array.isArray(data.headers) ? data.headers : [];
        const nextRowsRaw = Array.isArray(data.rows) ? data.rows : [];
        const nextRows = nextRowsRaw.map((row) => {
            if (row && typeof row === "object" && !Array.isArray(row)) return row;
            if (!Array.isArray(row)) return {};

            const normalized = {};
            nextHeaders.forEach((header, idx) => {
                normalized[header] = row[idx];
            });
            return normalized;
        });

        setHeaders(nextHeaders);
        setRows(nextRows);
        setTotalRows(Number(data.total_rows || 0));

        return data;
    }, []);

    const startPolling = useCallback(
        (id) => {
            if (pollRef.current) clearInterval(pollRef.current);
            let tickInFlight = false;
            previewTickRef.current = 0;

            pollRef.current = setInterval(async () => {
                if (tickInFlight) return;
                tickInFlight = true;

                try {
                    const meta = await fetchJobMeta(id);
                    const status = String(meta?.status || "").toLowerCase();

                    if (LIVE_PREVIEW_STATUSES.has(status)) {
                        const isTerminal = status === "done";
                        const shouldRefreshPreview = isTerminal || previewTickRef.current % 4 === 0;
                        previewTickRef.current += 1;

                        if (!shouldRefreshPreview) {
                            tickInFlight = false;
                            return;
                        }

                        try {
                            await fetchPreviewPage(id, previewPageRef.current, previewPageSizeRef.current, previewQueryRef.current);
                        } catch {
                            // keep polling meta even if preview call fails
                        }
                    }

                    if (status === "done" || status === "failed") {
                        clearInterval(pollRef.current);
                        pollRef.current = null;

                        await loadJobs();

                        if (status === "done") {
                            setPage(1);
                            setQuery("");
                            setIsModalOpen(false);
                            setModalData(null);
                            await fetchPreviewPage(id, 1, previewPageSizeRef.current, "");
                        }
                    }
                } catch {
                    // ignore
                } finally {
                    tickInFlight = false;
                }
            }, 1200);
        },
        [fetchJobMeta, loadJobs, fetchPreviewPage]
    );

    const downloadResult = useCallback(async () => {
        if (!jobId) return;

        try {
            const res = await axiosInstance.get(`/csv-vehicle/jobs/${jobId}/download`, {
                responseType: "blob",
            });

            const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
            const url = window.URL.createObjectURL(blob);

            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `enriched_${jobId}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();

            window.URL.revokeObjectURL(url);
            toast.success("CSV downloaded successfully");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Download failed");
        }
    }, [jobId]);

    const upload = useCallback(async () => {
        setJobError("");
        const err = validateFile(file);

        if (err) {
            setJobError(err);
            toast.error(err);
            return;
        }

        setIsUploading(true);
        const uploadToast = toast.loading("Uploading and starting processing...");

        setHeaders([]);
        setRows([]);
        setTotalRows(0);
        setJobRows(0);
        setJobCols(0);

        setIsModalOpen(false);
        setModalData(null);

        setJobStatus("processing");
        setElapsedSec(0);
        startMsRef.current = Date.now();

        try {
            const form = new FormData();
            form.append("file", file);

            const res = await axiosInstance.post("/csv-vehicle/process-csv", form, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const id = res?.data?.job_id;
            if (!id) throw new Error("No job_id returned from server");

            setJobId(id);
            setJobStatus(String(res?.data?.status || "processing").toLowerCase());
            setPage(1);
            setQuery("");

            await loadJobs().catch(() => {});

            let effectiveStatus = String(res?.data?.status || "processing").toLowerCase();
            try {
                const meta = await fetchJobMeta(id);
                effectiveStatus = String(meta?.status || effectiveStatus).toLowerCase();
            } catch {
                // if metadata endpoint is temporarily failing, keep job running and poll later
            }

            if (LIVE_PREVIEW_STATUSES.has(effectiveStatus)) {
                try {
                    await fetchPreviewPage(id, 1, pageSize, "");
                } catch {
                    // preview may be temporarily unavailable while processing
                }
            }
            startPolling(id);

            toast.success("Upload successful! Processing started.", { id: uploadToast });
        } catch (e) {
            const message = e?.response?.data?.detail || e?.message || "Upload failed";
            setJobError(String(message));
            setJobStatus("failed");
            toast.error(String(message), { id: uploadToast });
        } finally {
            setIsUploading(false);
        }
    }, [file, validateFile, loadJobs, fetchJobMeta, fetchPreviewPage, pageSize, startPolling]);

    const openJob = useCallback(
        async (id) => {
            resetAll();
            const openToast = toast.loading("Opening job...");
            setJobId(id);
            setPage(1);
            setQuery("");
            setIsModalOpen(false);
            setModalData(null);

            try {
                const meta = await fetchJobMeta(id);
                if (LIVE_PREVIEW_STATUSES.has(String(meta?.status || "").toLowerCase())) {
                    try {
                        await fetchPreviewPage(id, 1, pageSize, "");
                    } catch {
                        // keep job open even if preview endpoint is temporarily unavailable
                    }
                }

                if (meta.status === "processing" || meta.status === "queued") {
                    setElapsedSec(0);
                    startMsRef.current = Date.now();
                    startPolling(id);
                }

                toast.success(`Job #${id} opened`, { id: openToast });
            } catch (error) {
                const status = error?.response?.status;
                const transient = !status || status >= 500;
                if (transient) {
                    setJobStatus("processing");
                    startPolling(id);
                    setJobError("Backend temporarily unavailable for job metadata. Auto-retrying...");
                    toast.error("Job opened, metadata sync pending", { id: openToast });
                    return;
                }

                setJobError("Job not found or you have no access.");
                toast.error("Failed to open job", { id: openToast });
            }
        },
        [fetchJobMeta, fetchPreviewPage, pageSize, resetAll, startPolling]
    );

    const deleteJob = useCallback(
        async (id) => {
            if (!confirm("Delete this job?")) return;
            const delToast = toast.loading("Deleting job...");

            try {
                await axiosInstance.delete(`/csv-vehicle/jobs/${id}`);
                if (jobId === id) resetAll();
                await loadJobs();
                toast.success("Job deleted", { id: delToast });
            } catch (e) {
                toast.error(e?.response?.data?.detail || "Failed to delete job", { id: delToast });
            }
        },
        [jobId, resetAll, loadJobs]
    );

    useEffect(() => {
        if (!jobId || !LIVE_PREVIEW_STATUSES.has(String(jobStatus || "").toLowerCase())) return;
        fetchPreviewPage(jobId, page, pageSize, debouncedQuery).catch(() => {
            // do not interrupt UI due to transient preview errors
        });
    }, [jobId, jobStatus, page, pageSize, debouncedQuery, fetchPreviewPage]);

    useEffect(() => {
        setPage(1);
    }, [debouncedQuery, pageSize]);

    const statusBadge = useMemo(() => {
        const status = jobStatus;
        if (!status) return null;

        const base = "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md";
        if (status === "done") return <span className={`${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]`}>done</span>;
        if (status === "failed") return <span className={`${base} border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]`}>failed</span>;
        if (status === "processing" || status === "queued") return <span className={`${base} border-blue-500/30 bg-blue-500/10 text-blue-400 animate-pulse`}>{status}</span>;
        return <span className={`${base} border-white/20 bg-white/5 text-white/60`}>{status}</span>;
    }, [jobStatus]);

    if (!ready) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#020202]">
                <div className="text-white/70 text-sm uppercase tracking-[0.2em]">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen w-full bg-[#020202] text-white overflow-hidden">
            <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "42px 42px" }} />
            <div className="absolute -top-[28rem] -left-[18rem] h-[44rem] w-[44rem] rounded-full bg-emerald-500/10 blur-[180px]" />
            <div className="absolute -bottom-[30rem] -right-[18rem] h-[44rem] w-[44rem] rounded-full bg-blue-500/10 blur-[180px]" />

            <div className="relative mx-auto max-w-6xl px-4 py-10 md:py-12">
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 accent-glow-sm">
                            <UploadCloud className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-white/45 font-bold">
                                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                                Vehicle Intelligence Console
                            </div>
                            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight uppercase italic text-gradient">
                                Dashboard <span className="emerald-gradient">v2</span>
                            </h1>
                        </div>
                    </div>

                    <Button variant="outline" className="rounded-2xl border-white/15 h-11 px-5" onClick={() => router.push("/logout")}>
                        <LogOut className="mr-1.5 h-4 w-4" />
                        Logout
                    </Button>
                </motion.div>

                <div className="flex flex-col gap-6">
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
                        <CardContent className="p-0 grid gap-6 md:grid-cols-[420px_1fr]">
                            <UploadCard
                                getRootProps={getRootProps}
                                getInputProps={getInputProps}
                                isDragActive={isDragActive}
                                statusBadge={statusBadge}
                                isProcessing={isProcessing}
                                open={open}
                                upload={upload}
                                file={file}
                                isUploading={isUploading}
                                resetAll={resetAll}
                                downloadResult={downloadResult}
                                jobId={jobId}
                                jobStatus={jobStatus}
                                elapsedSec={elapsedSec}
                                processedRows={processedRows}
                                jobRows={jobRows}
                                durationMs={durationMs}
                                csvPreviewRows={csvPreviewRows}
                            />

                            <JobsHistory jobs={jobs} jobError={jobError} openJob={openJob} deleteJob={deleteJob} />
                        </CardContent>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.14 }}>
                        <ResultsSection
                            jobId={jobId}
                            jobStatus={jobStatus}
                            jobRows={jobRows}
                            jobCols={jobCols}
                            headers={headers}
                            rows={rows}
                            totalRows={totalRows}
                            query={query}
                            setQuery={setQuery}
                            page={page}
                            setPage={setPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            isProcessing={isProcessing}
                            elapsedSec={elapsedSec}
                            downloadResult={downloadResult}
                            openModal={openModal}
                        />
                    </motion.div>
                </div>
            </div>

            <DetailsModal isOpen={isModalOpen} data={modalData} onClose={closeModal}>
                <DebugTable data={modalData} />
            </DetailsModal>
        </div>
    );
}
