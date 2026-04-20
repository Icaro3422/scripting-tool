import { useCallback, useEffect, useRef, useState } from "react";
import type { BillingSummary, OpenRouterActivityState } from "@/types/billing";

export function useBillingSummary() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/billing/summary")
      .then((r) => r.json())
      .then((data) => {
        if (mounted && data.balanceCents !== undefined) setSummary(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { summary, loading };
}

export function useOpenRouterActivity() {
  const [state, setState] = useState<OpenRouterActivityState>({ loading: true });
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchActivity = useCallback(async (date: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({ loading: true });
    const q = date.trim() ? `?date=${encodeURIComponent(date.trim())}` : "";

    try {
      const r = await fetch(`/api/billing/openrouter-activity${q}`, {
        signal: controller.signal,
      });
      const data = await r.json();

      if (data.configured === false) {
        setState({ loading: false, configured: false, message: data.message });
      } else {
        setState({
          loading: false,
          configured: true,
          ok: data.ok === true,
          status: data.status ?? 0,
          date: data.date,
          data: data.data,
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState({
        loading: false,
        configured: true,
        ok: false,
        status: 0,
        data: { error: "No se pudo cargar la actividad." },
      });
    }
  }, []);

  useEffect(() => {
    fetchActivity("");
    return () => abortControllerRef.current?.abort();
  }, [fetchActivity]);

  return { state, fetchActivity };
}
