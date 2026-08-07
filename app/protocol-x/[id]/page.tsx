import blueprintsData from "@/data/blueprints.json";
import BlueprintContent from "./BlueprintContent";

interface Blueprint {
  id: string;
  [key: string]: unknown;
}

const blueprints = blueprintsData as Blueprint[];

export function generateStaticParams() {
  return blueprints.map((b) => ({ id: b.id }));
}

export default function BlueprintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <BlueprintContent params={params} />;
}
