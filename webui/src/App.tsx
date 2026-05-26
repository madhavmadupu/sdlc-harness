import { useState } from "react";
import Dashboard from "@/pages/Dashboard";
import Memory from "@/pages/Memory";
import Config from "@/pages/Config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Database, Settings } from "lucide-react";

type Tab = "dashboard" | "memory" | "config";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex items-center h-14 px-4">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <LayoutDashboard className="h-5 w-5" />
            SDLC Harness Dashboard
          </div>
        </div>
      </header>

      {/* Nav + Content */}
      <div className="container px-4 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="memory" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Memory
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>
          <TabsContent value="memory">
            <Memory />
          </TabsContent>
          <TabsContent value="config">
            <Config />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
