import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Toaster } from "@/components/ui/toaster";
import ProposalGenerator from "@/pages/ProposalGenerator";
import HistoryPage from "@/pages/HistoryPage";
import NotFound from "@/pages/not-found";

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Toaster />
      <Switch>
        <Route path="/" component={ProposalGenerator} />
        <Route path="/history" component={HistoryPage} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}
