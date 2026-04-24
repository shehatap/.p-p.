import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Toaster } from "./toaster";
import ProposalGenerator from "./ProposalGenerator";
import HistoryPage from "./HistoryPage";
import NotFound from "./not-found";

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
