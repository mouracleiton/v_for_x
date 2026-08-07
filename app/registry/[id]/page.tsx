import dossiersData from "@/data/dossier-seed.json";
import DossierContent from "./DossierContent";

interface Dossier {
  id: string;
}

const dossiers = dossiersData as Dossier[];

export function generateStaticParams() {
  return dossiers.map((d) => ({ id: d.id }));
}

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <DossierContent params={params} />;
}
