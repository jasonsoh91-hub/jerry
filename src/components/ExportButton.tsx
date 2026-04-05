"use client";

import { useState } from "react";
import html2canvas from "html2canvas";

interface ExportButtonProps {
  dashboardRef: React.RefObject<HTMLDivElement>;
  aspectRatio: "1:1" | "3:4";
  label: string;
  className?: string;
}

export default function ExportButton({ dashboardRef, aspectRatio, label, className = "" }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!dashboardRef.current) return;

    setIsExporting(true);
    try {
      const dashboard = dashboardRef.current;
      const baseWidth = 1200;
      const height = aspectRatio === "1:1" ? baseWidth : Math.round(baseWidth * (4/3));

      const canvas = await html2canvas(dashboard, {
        width: baseWidth,
        height: height,
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `jerry-dashboard-${aspectRatio.replace(":", "x")}-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
        setIsExporting(false);
      }, "image/png", 0.95);
    } catch (error) {
      console.error("Export failed:", error);
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isExporting ? "Exporting..." : label}
    </button>
  );
}
