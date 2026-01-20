"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import Script from "next/script";

interface ScannerProps {
    onScan: (result: string) => void;
    isScanning: boolean;
    setIsScanning: (scanning: boolean) => void;
}

declare global {
    interface Window {
        cv: any;
    }
}

export default function Scanner({ onScan, isScanning, setIsScanning }: ScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>("");
    const [cvLoaded, setCvLoaded] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Scan stats for debug
    const [debugInfo, setDebugInfo] = useState("");

    const codeReader = useRef(new BrowserMultiFormatReader());
    const streamRef = useRef<MediaStream | null>(null);
    const scanLoopRef = useRef<number | null>(null);

    // Load OpenCV
    const handleCvLoad = () => {
        // Wait for runtime to be ready
        if (window.cv && window.cv.getBuildInformation) {
            setCvLoaded(true);
            console.log("OpenCV.js Loaded");
        } else {
            // Sometimes cv is defined but not ready, wait a bit
            setTimeout(handleCvLoad, 50);
        }
    };

    useEffect(() => {
        if (!isScanning) {
            stopScan();
            return;
        }

        startScan();

        return () => {
            stopScan();
        };
    }, [isScanning, cvLoaded]);

    const startScan = async () => {
        if (!cvLoaded) return; // Wait for CV
        if (!videoRef.current) return;

        try {
            const constraints = {
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            videoRef.current.srcObject = stream;

            // Wait for video to play
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play();
                requestAnimationFrame(processFrame);
            };

        } catch (err: any) {
            setError("Camera access denied or failed.");
            setIsScanning(false);
        }
    };

    const stopScan = () => {
        if (scanLoopRef.current) {
            cancelAnimationFrame(scanLoopRef.current);
            scanLoopRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    const processFrame = async () => {
        if (!isScanning || !videoRef.current || !canvasRef.current || !window.cv) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            setProcessing(true);
            try {
                // 1. Try Normal Decode First (Fastest)
                if (await decodeFromCanvas(canvas, "Normal")) {
                    setProcessing(false);
                    return; // Success, loop stops automatically via onScan logic if parent closes, but we keep running if parent keeps open
                }

                // 2. Grayscale
                let src = window.cv.imread(canvas);
                let dst = new window.cv.Mat();
                window.cv.cvtColor(src, dst, window.cv.COLOR_RGBA2GRAY, 0);

                // Draw back to canvas for decoding
                window.cv.imshow(canvas, dst);
                if (await decodeFromCanvas(canvas, "Grayscale")) {
                    src.delete(); dst.delete();
                    setProcessing(false);
                    return;
                }

                // 3. High Contrast (Histogram Equalization)
                window.cv.equalizeHist(dst, dst);
                window.cv.imshow(canvas, dst);
                if (await decodeFromCanvas(canvas, "Contrast")) {
                    src.delete(); dst.delete();
                    setProcessing(false);
                    return;
                }

                // 4. Binarization (Threshold)
                // block size 11, C 2
                window.cv.adaptiveThreshold(dst, dst, 255, window.cv.ADAPTIVE_THRESH_GAUSSIAN_C, window.cv.THRESH_BINARY, 11, 2);
                window.cv.imshow(canvas, dst);
                if (await decodeFromCanvas(canvas, "Threshold")) {
                    src.delete(); dst.delete();
                    setProcessing(false);
                    return;
                }

                src.delete();
                dst.delete();

            } catch (e) {
                console.error("CV Error", e);
            }
            setProcessing(false);
        }

        // Schedule next frame
        // throttle slightly to save battery if needed, but for hard decode we want max attempt rate
        scanLoopRef.current = requestAnimationFrame(processFrame);
    };

    const decodeFromCanvas = async (canvas: HTMLCanvasElement, method: string): Promise<boolean> => {
        try {
            // ZXing Browser decode from canvas
            // We can use decodeFromCanvas method of codeReader

            // Note: codeReader.decodeFromCanvas often takes an image element or url. 
            // We use the simpler `decodeFromImageElement` if we have an image, or just pass data URL?
            // Actually BrowserMultiFormatReader has decodeFromCanvas but it expects an ID or element. It re-reads the element.

            // Better: Capture data from canvas and pass to reader (or helper)
            // But codeReader is designed to attach to a loop. We are manually driving the loop.
            // Using `decodeFromImage` with a data URL from canvas is heavy.

            // Use `decodeFromCanvas` by passing the ref directly. 
            // However, ZXing's `decodeFromCanvas` might be running its own loop if we are not careful.
            // We want SINGLE SHOT decode.

            // The library exposes `decodeOnceFromVideoDevice` etc. 
            // For simple image/canvas: `decodeFromCanvas(canvas)` returns a promise with result.
            // But we modified the content of canvas!

            const result = await codeReader.current.decodeFromCanvas(canvas);

            if (result) {
                const text = result.getText();
                console.log(`Scanned (${method}):`, text);
                setDebugInfo(`Found via ${method}`);
                onScan(text);
                return true;
            }
        } catch (err) {
            // NotFoundException is normal
        }
        return false;
    };

    if (!isScanning) {
        return (
            <>
                <Script
                    src="/lib/opencv.js"
                    strategy="lazyOnload"
                    onLoad={handleCvLoad}
                />
                <button
                    onClick={() => setIsScanning(true)}
                    className="btn btn-primary w-full flex justify-center items-center gap-2 py-4 text-lg bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all"
                    disabled={!cvLoaded}
                >
                    {cvLoaded ? <Camera className="w-6 h-6" /> : <Loader2 className="animate-spin w-5 h-5" />}
                    {cvLoaded ? "Start Advanced Scanner" : "Loading Engine..."}
                </button>
            </>
        );
    }

    return (
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video shadow-xl ring-1 ring-gray-900/5">
            {/* The video source (hidden, we draw to canvas) */}
            <video
                ref={videoRef}
                className="hidden" // Hiding video, showing canvas
                playsInline
                muted
                autoPlay
            />

            {/* The Processing Canvas (Visible) */}
            <canvas
                ref={canvasRef}
                className="w-full h-full object-cover"
            />

            {/* Overlay */}
            <div className="absolute inset-0 border-2 border-blue-500/30 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-40 border-2 border-red-500/80 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-red-500 -mt-1 -ml-1"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-red-500 -mt-1 -mr-1"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-red-500 -mb-1 -ml-1"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-red-500 -mb-1 -mr-1"></div>
                </div>
            </div>

            {/* Debug Info */}
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {processing ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                Mode: Hard Decode {debugInfo && `| ${debugInfo}`}
            </div>

            <button
                onClick={() => setIsScanning(false)}
                className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            >
                <CameraOff className="w-5 h-5" />
            </button>

            {error && (
                <div className="absolute bottom-0 inset-x-0 bg-red-600 text-white p-2 text-center text-sm">
                    {error}
                </div>
            )}
        </div>
    );
}
