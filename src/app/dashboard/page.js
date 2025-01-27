'use client';

import React, {useCallback, useEffect, useState} from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import axiosInstance from "@/utils/axios";
import {useRouter} from "next/navigation";
import {useAuth} from "@/hooks/useAuth";


const Page = () => {
    const [uploadedFile, setUploadedFile] = useState(null);

    const [isUploading, setIsUploading] = useState(false);
    const {isLoggedIn} = useAuth()

const router = useRouter()



    useEffect(() => {
        if(!isLoggedIn ) {
            router.push("/login")
        }
    }, [isLoggedIn]);

    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setUploadedFile(file);

            // Convert file to Base64
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result.split(',')[1]; // Extract Base64 string
                uploadFileToServer(base64String, file.name); // Call upload function
            };
            reader.readAsDataURL(file);
        }
    }, []);


    const uploadFileToServer = async (base64String, fileName) => {
        setIsUploading(true);
        try {
            const response = await axiosInstance.post('/csv-vehicle/process-csv', {
                file: base64String
            });

            alert('File uploaded successfully! You will get on email result in 5-10 minutes.');
            setUploadedFile(null)
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload the file!');
        } finally {
            setIsUploading(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'text/csv': ['.csv'] },
        maxFiles: 1,
    });

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800">
            <Card className="w-2/3 shadow-lg pt-20">
                <CardHeader>
                    <CardTitle className="text-center text-2xl font-bold">
                        Dashboard
                    </CardTitle>
                    <CardDescription className="text-center">
                        Drag & drop files or click to upload
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div
                        {...getRootProps()}
                        className={`flex flex-col items-center justify-center border-2 border-dashed ${
                            isDragActive ? 'border-blue-500' : 'border-gray-300'
                        } rounded-lg p-10 bg-gray-50 dark:bg-gray-800 transition-all cursor-pointer`}
                    >
                        <input {...getInputProps()} />
                        <p className="text-gray-600 dark:text-gray-300">
                            {isDragActive
                                ? 'Drop the files here...'
                                : 'Drag & drop files here, or click to select'}
                        </p>
                        <Button variant="outline" className="mt-4">
                            Browse Files
                        </Button>
                    </div>

                    {uploadedFile && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold">Uploaded Files:</h3>
                            <div className="mt-2 space-y-2">
                                <div
                                    className="flex items-center justify-between px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-800"
                                >
                                    <span className="text-sm font-medium">{uploadedFile.name}</span>
                                    <span className="text-xs text-gray-500">
                      {(uploadedFile.size / 1024).toFixed(2)} KB
                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                </CardContent>
            </Card>

        </div>
    );
}

export default Page