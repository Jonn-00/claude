import { createRoot } from "react-dom/client";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import TodayPage from "@/app/page";
import ChannelsPage from "@/app/channels/page";
import AgencyPage from "@/app/agency/page";
import PlannerPage from "@/app/planner/page";
import NotesPage from "@/app/notes/page";

const PAGES: Record<string, () => React.ReactNode> = {
  "/": TodayPage,
  "/channels": ChannelsPage,
  "/agency": AgencyPage,
  "/planner": PlannerPage,
  "/notes": NotesPage,
};

function App() {
  const path = usePathname();
  const Page = PAGES[path] ?? TodayPage;
  return (
    <AppShell>
      <Page key={path} />
    </AppShell>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
