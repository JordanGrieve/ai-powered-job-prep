import { Suspense } from "react";
import { ReactNode } from "react";

export async function SuspendedItem<T>({
  item,
  fallback,
  result,
}: {
  item: Promise<T>;
  fallback: ReactNode;
  result: (item: T) => ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <InnerComponent item={item} result={result} />
    </Suspense>
  );
}

async function InnerComponent<T>({
  item,
  result,
}: {
  item: Promise<T>;
  result: (item: T) => ReactNode;
}) {
  return result(await item);
}
