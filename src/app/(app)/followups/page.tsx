import { redirect } from "next/navigation";

export default async function FollowupsPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const { bucket } = await searchParams;
  redirect(bucket ? `/tasks?bucket=${bucket}` : "/tasks");
}
