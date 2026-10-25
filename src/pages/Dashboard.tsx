import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FamilyWorkspace } from "@/components/FamilyWorkspace";
import { signOut, useAuth } from "@/lib/auth";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">ChoreReward family quest</h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/settings")}>
              Settings
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
            <div className="min-w-0 max-w-[10rem] truncate text-sm text-muted-foreground">
              {user?.name || user?.email}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <FamilyWorkspace />
      </div>
    </div>
  );
}
