import { Toggle } from "../components/Toggle";
import { useLab } from "../context/LabContext";

export default function LabSettings() {
  const { chaos, a11y, apiFlaky, setFlag } = useLab();

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Lab Control Center</h1>
      <Toggle
        label="Chaos Mode"
        description="Losowe data-testid/ID przy każdym renderze."
        checked={chaos}
        onChange={(v) => setFlag("chaos", v)}
      />
      <Toggle
        label="A11y Regression Mode"
        description="Zaburza semantykę HTML i dostępność."
        checked={a11y}
        onChange={(v) => setFlag("a11y", v)}
      />
      <Toggle
        label="API Flaky Mode"
        description="Losowe 500 / opóźnienia / złe formaty odpowiedzi."
        checked={apiFlaky}
        onChange={(v) => setFlag("apiFlaky", v)}
      />
    </div>
  );
}
