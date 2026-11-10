// Phase K.51 — Smart Sales Import. Nothing reaches the sales ledger until commit.
import { request, axiosInstance } from "./http";

const BASE = "/catalytic/sales/imports";
const at = (id, path = "") => `${BASE}/${encodeURIComponent(id)}${path}`;

export function uploadSalesFile(file) {
    const form = new FormData();
    form.append("file", file);
    return request(() => axiosInstance.post(BASE, form, { headers: { "Content-Type": "multipart/form-data" } }), "Failed to read the file");
}

export const listSalesImports = () => request(() => axiosInstance.get(BASE), "Failed to load imports");
export const getSalesImport = (id) => request(() => axiosInstance.get(at(id)), "Failed to load the import");
export const setSalesImportStructure = (id, { sheetName, headerRow }) =>
    request(() => axiosInstance.post(at(id, "/structure"), { sheet_name: sheetName, header_row: headerRow }), "Failed to re-read the sheet");
export const setSalesImportMapping = (id, { mapping, options }) =>
    request(() => axiosInstance.put(at(id, "/mapping"), { mapping, options }), "Failed to apply the mapping");
// Only on request: sends column names and five masked sample rows to the AI.
export const suggestSalesImportMapping = (id) => request(() => axiosInstance.post(at(id, "/ai-suggest")), "AI suggestion failed");
export const listSalesImportRows = (id, params) => request(() => axiosInstance.get(at(id, "/rows"), { params }), "Failed to load rows");
export const editSalesImportRow = (id, rowId, edits) =>
    request(() => axiosInstance.patch(at(id, `/rows/${encodeURIComponent(rowId)}`), { edits }), "Failed to save the row");
export const setSalesImportDecision = (id, { decision, rowIds, status }) =>
    request(() => axiosInstance.post(at(id, "/decisions"), { decision, row_ids: rowIds, status }), "Failed to update rows");
export const listSalesImportTemplates = () => request(() => axiosInstance.get(`${BASE}/templates`), "Failed to load templates");
export const saveSalesImportTemplate = (id, name) => request(() => axiosInstance.post(at(id, "/templates"), { name }), "Failed to save the template");
export const applySalesImportTemplate = (id, templateId) =>
    request(() => axiosInstance.post(at(id, "/apply-template"), { template_id: templateId }), "Failed to apply the template");
export const commitSalesImport = (id) => request(() => axiosInstance.post(at(id, "/commit")), "Import failed; nothing was saved");
export const discardSalesImport = (id) => request(() => axiosInstance.post(at(id, "/discard")), "Failed to discard the import");

// K.51 review — linked vs unlinked imported sales. Listing and suggestions only read.
export const listImportedSales = (params) => request(() => axiosInstance.get("/catalytic/sales/linking", { params }), "Failed to load imported sales");
export const getLinkSuggestions = (saleId, search) =>
    request(() => axiosInstance.get(`/catalytic/sales/linking/${encodeURIComponent(saleId)}/suggestions`, { params: search ? { search } : {} }), "Failed to load suggestions");
export const linkImportedSale = (saleId, converterId) =>
    request(() => axiosInstance.post(`/catalytic/sales/linking/${encodeURIComponent(saleId)}`, { converter_id: converterId }), "Failed to link the sale");
