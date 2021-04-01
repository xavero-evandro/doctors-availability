import knex from "knex";
// Uncomment and use date-fns if you want.
// import ... from "date-fns";

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

const getAvailabilities = async (date) => {
  // Implement your algorithm here. Create as many functions as you like, but no extra files please.
};

export default getAvailabilities;
