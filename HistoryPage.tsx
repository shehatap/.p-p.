import { useQuery } from "@tanstack/react-query";

const API_BASE = ""; // Same-origin Express server
import { Link } from "wouter";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import { Skeleton } from "./skeleton";
import { ArrowLeft, Download, FileText, Leaf, Clock } from "lucide-react";

interface ProposalSummary {
  id: string;
  clientName: string;
  estimateNumber: string;
  estimateTotal: string;
  status: string;
  createdAt: number;
}

function statusBadge(status: string) {
  if (status === "done")
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Ready</Badge>;
  if (status === "generating")
    return <Badge variant="secondary">Generating…</Badge>;
  if (status === "error")
    return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export default function HistoryPage() {
  const { data: proposals, isLoading } = useQuery<ProposalSummary[]>({
    queryKey: ["/api/proposals"],
    refetchInterval: 5000,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Leaf size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm" style={{ fontFamily: "'Work Sans', sans-serif" }}>
              Snappy Landscaping
            </h1>
            <p className="text-xs text-muted-foreground">Proposal Generator</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" data-testid="btn-back">
              <ArrowLeft size={14} /> Back
            </Button>
          </Link>
          <h2 className="text-xl font-bold">Proposal History</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : !proposals?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No proposals yet</p>
            <p className="text-sm mt-1">Generate your first proposal to see it here.</p>
            <Link href="/">
              <Button className="mt-4 gap-2">
                <FileText size={14} /> Create Proposal
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map(p => (
              <Card key={p.id} data-testid={`card-proposal-${p.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{p.clientName || "Unknown Client"}</p>
                        {statusBadge(p.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{p.estimateNumber}</span>
                        <span className="font-semibold text-primary">{p.estimateTotal}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(p.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>
                    {p.status === "done" && (
                      <a href={`${API_BASE}/api/proposal/${p.id}/download`} download>
                        <Button size="sm" className="gap-1.5 shrink-0" data-testid={`btn-download-${p.id}`}>
                          <Download size={14} /> Download
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
