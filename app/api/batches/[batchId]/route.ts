/**
 * Removing a batch.
 *
 * Its companies are un-assigned rather than deleted - tidying up a heading
 * should never take the companies underneath it with it.
 */

import { describe } from "@/lib/errors";
import { deleteBatch, listBatches } from "@/lib/deals-store";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await context.params;

  const batches = await listBatches();
  if (!batches.some((batch) => batch.id === batchId)) {
    return Response.json({ error: `Unknown batch: ${batchId}` }, { status: 404 });
  }

  try {
    await deleteBatch(batchId);
    return Response.json({ deleted: batchId });
  } catch (problem) {
    return Response.json({ error: describe(problem) }, { status: 500 });
  }
}
