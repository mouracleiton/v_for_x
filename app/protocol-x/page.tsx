import { Suspense } from "react";
import ProtocolXContent from "./ProtocolXContent";

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
