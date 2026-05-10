import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Event } from "@/types/event";

type EventsContextType = {
  events: Event[];
  setEvents: (events: Event[]) => void;
  updateEvent: (updated: Event) => void;
};

const EventsContext = createContext<EventsContextType | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);

  const updateEvent = useCallback((updated: Event) => {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }, []);

  return (
    <EventsContext.Provider value={{ events, setEvents, updateEvent }}>
      {children}
    </EventsContext.Provider>
  );
}

export function useEventsContext() {
  const ctx = useContext(EventsContext);
  if (!ctx)
    throw new Error("useEventsContext must be used inside EventsProvider");
  return ctx;
}
