import knex from "knex";
import { format } from "date-fns";

export const knexClient = knex({
  client: "sqlite3",
  connection: ":memory:",
  useNullAsDefault: true,
});

export const migrate = () =>
  knexClient.schema.createTable("events", (table) => {
    table.increments();
    table.dateTime("starts_at").notNullable();
    table.dateTime("ends_at").notNullable();
    table.enum("kind", ["appointment", "opening"]).notNullable();
    table.boolean("weekly_recurring");
  });

// const getAllAvailabilites = async () => {
//   return knex.select("*").table("events");
// };

const getAvailabilities = async (date) => {
  return date;
};

export default getAvailabilities;
