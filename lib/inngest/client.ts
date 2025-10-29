import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "bravi-youtube-app",
  name: "Bravi Youtube App",
  eventKey: process.env.INNGEST_EVENT_KEY,
  apiKey: process.env.INNGEST_API_KEY,
});
