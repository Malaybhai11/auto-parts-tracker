"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Loader2, Camera, CameraOff } from "lucide-react";

interface ScannerProps {
    onScan: (result: string) => void;
    isScanning: boolean;
    setIsScanning: (scanning: boolean) => void;
}

export default function Scanner({ onScan, isScanning, setIsScanning }: ScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const controlsRef = useRef<any>(null);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        if (!isScanning) {
            if (controlsRef.current) {
                controlsRef.current.stop();
                controlsRef.current = null;
            }
            return;
        }

        const codeReader = new BrowserMultiFormatReader();
        let mounted = true;

        const startScanning = async () => {
            try {
                // Check for Secure Context (HTTPS or localhost)
                if (!window.isSecureContext) {
                    throw new Error("Camera access requires HTTPS or localhost. You are likely on HTTP IP.");
                }

                const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();

                if (videoInputDevices.length === 0) {
                    throw new Error("No camera devices found.");
                }

                // Prefer back camera
                const selectedDeviceId = videoInputDevices.find(
                    (device) => device.label.toLowerCase().includes("back")
                )?.deviceId || videoInputDevices[0].deviceId;

                if (!mounted) return;

                controlsRef.current = await codeReader.decodeFromVideoDevice(
                    selectedDeviceId,
                    videoRef.current!,
                    (result, err) => {
                        if (result) {
                            onScan(result.getText());
                            // Optional: Stop scanning after successful scan? 
                            // For rapid scanning, we might want to keep it open, but usually better to pause to avoid double scans.
                            // We'll let the parent handle logic, but maybe debounce here.
                        }
                        if (err) {
                            // Ignore NotFoundException (scanning...)
                            if (err.name !== 'NotFoundException') {
                                console.error(err);
                            }
                        }
                    }
                );
            } catch (err: any) {
                console.error(err);
                setError(err.message || "Could not access camera.");
                setIsScanning(false);
            }
        };

        startScanning();

        return () => {
            mounted = false;
            if (controlsRef.current) {
                controlsRef.current.stop();
                controlsRef.current = null;
            }
        };
    }, [isScanning, onScan, setIsScanning]);

    if (!isScanning) {
        return (
            <button
                onClick={() => setIsScanning(true)}
                className="btn btn-primary w-full flex justify-center items-center gap-2 py-4 text-lg"
            >
                <Camera className="w-6 h-6" />
                Scan Barcode
            </button>
        );
    }

    return (
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
            />

            {/* Overlay */}
            <div className="absolute inset-0 border-2 border-blue-500/50 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-40 border-2 border-red-500/80 rounded-lg"></div>
            </div>

            <button
                onClick={() => setIsScanning(false)}
                className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
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
