import type { Metadata } from "next";
import { Suspense } from "react";
import { getMeta } from "@/lib/seo";
import ProtocolXContent from "./ProtocolXContent";

const meta = getMeta("/protocol-x/");

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: { canonical: `https://mouracleiton.github.io/v_for_x${meta.path}` },
  openGraph: { title: meta.title, description: meta.description },
};

export default function ProtocolXPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-blood-bright text-sm">
          <span className="cursor-blink">&gt; LOADING...</span>
        </div>
      }
    >
      <ProtocolXContent />
    </Suspense>
  );
}
