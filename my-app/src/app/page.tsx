"use client"

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";

interface ConvertedImage {
  image: string;
  page: number;
  description?: string;
}

export default function PDFUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [convertedImages, setConvertedImages] = useState<ConvertedImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setUploadStatus(null);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus('No file selected');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      setUploadStatus('Uploading...');

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadStatus('Upload successful');
      setConvertedImages(response.data.images);
    } catch (error) {
      console.error('Error uploading PDF:', error);
      setUploadStatus('Error uploading file');
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeImages = async () => {
    setIsAnalyzing(true);
    try {
      const analyzedImages = await Promise.all(
        convertedImages.map(async (img) => {
          const response = await axios.post('/api/analyze-image', { image: img.image });
          return { ...img, description: response.data.analyzedImage.description };
        })
      );
      setConvertedImages(analyzedImages);
    } catch (error) {
      console.error('Error analyzing images:', error);
      setUploadStatus('Error analyzing images');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Prompt Forge
          </h1>
          <p className="mt-2 text-muted-foreground">
            Upload a PDF to convert and analyze with AI
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : file
                ? 'border-primary/50 bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            <svg
              className="mb-4 h-10 w-10 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {file ? (
              <p className="text-sm font-medium text-foreground">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Drop your PDF here, or click to browse
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF files only
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full"
              size="lg"
            >
              {isUploading ? 'Uploading...' : 'Upload PDF'}
            </Button>
          </div>

          {uploadStatus && (
            <p className={`mt-4 text-center text-sm ${
              uploadStatus.includes('Error') ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              {uploadStatus}
            </p>
          )}
        </div>

        {convertedImages.length > 0 && (
          <div className="mt-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                Converted Pages ({convertedImages.length})
              </h2>
              <Button onClick={analyzeImages} disabled={isAnalyzing} variant="outline">
                {isAnalyzing ? 'Analyzing...' : 'Analyze All'}
              </Button>
            </div>

            <div className="space-y-6">
              {convertedImages.map((img, index) => (
                <div key={index} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  <div className="border-b px-5 py-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Page {img.page}
                    </h3>
                  </div>
                  <div className="p-4">
                    <img
                      src={`data:image/jpeg;base64,${img.image}`}
                      alt={`Page ${img.page}`}
                      className="w-full rounded-lg"
                    />
                  </div>
                  {img.description && (
                    <div className="border-t bg-muted/50 px-5 py-4">
                      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        AI Analysis
                      </h4>
                      <p className="text-sm leading-relaxed text-foreground">
                        {img.description}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
