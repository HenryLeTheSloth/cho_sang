import { useFetchers, useNavigation } from "react-router";

/** Chỉ báo bận toàn cục: điều hướng ("Xem thêm", lọc, tìm) và mọi thao tác giỏ. Hiện sau 150ms để không nháy. */
export function PendingBar() {
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const busy = navigation.state !== "idle" || fetchers.some((f) => f.state !== "idle");
  return <div aria-hidden className={`pending-bar ${busy ? "is-busy" : ""}`} />;
}
