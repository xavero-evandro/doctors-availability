import {
  getAvailabilities,
  knexClient,
  createEvents,
  migrate,
} from "../lib/getAvailabilities";

describe("getAvailabilities", () => {
  let availabilities;
  let availabilitiesSkeleton;

  beforeAll(() => migrate());

  beforeEach(() => knexClient("events").truncate());

  describe("skeleton", () => {
    beforeAll(async () => {
      availabilitiesSkeleton = await getAvailabilities(new Date("2020-01-01"));
    });

    it("returns an Object", () => {
      expect(typeof availabilitiesSkeleton === "object").toBe(true);
      expect(Array.isArray(availabilitiesSkeleton)).toBe(false);
    });

    it("key is a date string with format YYYY/MM/DD", () => {
      expect(Object.keys(availabilitiesSkeleton)[0]).toEqual("2020-01-01");
    });

    it("value is an Array", () => {
      expect(Object.values(availabilitiesSkeleton)[0]).toEqual([]);
    });

    it("returns the next seven days", () => {
      expect(Object.values(availabilitiesSkeleton).length).toBe(7);
    });

    it("full flow", () => {
      expect(availabilitiesSkeleton["2020-01-01"]).toEqual([]);
      expect(availabilitiesSkeleton["2020-01-02"]).toEqual([]);
      expect(availabilitiesSkeleton["2020-01-03"]).toEqual([]);
      expect(availabilitiesSkeleton["2020-01-04"]).toEqual([]);
      expect(availabilitiesSkeleton["2020-01-05"]).toEqual([]);
      expect(availabilitiesSkeleton["2020-01-06"]).toEqual([]);
      expect(availabilitiesSkeleton["2020-01-07"]).toEqual([]);
    });
  });

  describe("openings", () => {
    it("one opening", async () => {
      await createEvents([
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 11:00"),
          ends_at: new Date("2020-01-01 11:30"),
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-01"));
      expect(availabilities["2020-01-01"]).toEqual(["11:00"]);
    });

    it("30 minutes slots", async () => {
      await createEvents([
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 11:00"),
          ends_at: new Date("2020-01-01 12:00"),
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-01"));
      expect(availabilities["2020-01-01"]).toEqual(["11:00", "11:30"]);
    });

    it("several openings on the same day", async () => {
      await createEvents([
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 11:00"),
          ends_at: new Date("2020-01-01 12:00"),
        },
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 14:00"),
          ends_at: new Date("2020-01-01 15:00"),
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-01"));
      expect(availabilities["2020-01-01"]).toEqual([
        "11:00",
        "11:30",
        "14:00",
        "14:30",
      ]);
    });

    it("several openings on 2 days", async () => {
      await createEvents([
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 11:00"),
          ends_at: new Date("2020-01-01 12:00"),
        },
        {
          kind: "opening",
          starts_at: new Date("2020-01-02 14:00"),
          ends_at: new Date("2020-01-02 15:00"),
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-01"));
      expect(availabilities["2020-01-01"]).toEqual(["11:00", "11:30"]);
      availabilities = await getAvailabilities(new Date("2020-01-02"));
      expect(availabilities["2020-01-02"]).toEqual(["14:00", "14:30"]);
    });

    it("format", async () => {
      await createEvents([
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 09:00"),
          ends_at: new Date("2020-01-01 09:30"),
        },
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 14:00"),
          ends_at: new Date("2020-01-01 14:30"),
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-01"));
      expect(availabilities["2020-01-01"]).toEqual(["9:00", "14:00"]);
    });
  });

  describe("appointments", () => {
    beforeEach(
      async () =>
        await createEvents([
          {
            kind: "opening",
            starts_at: new Date("2020-01-01 09:00"),
            ends_at: new Date("2020-01-01 10:00"),
          },
        ])
    );

    it("an appointment of one slot", async () => {
      await createEvents([
        {
          kind: "appointment",
          starts_at: new Date("2020-01-01 09:00"),
          ends_at: new Date("2020-01-01 09:30"),
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-01"));
      expect(availabilities["2020-01-01"]).toEqual(["9:30"]);
    });

    it("an appointment of several slots", async () => {
      await createEvents([
        {
          kind: "appointment",
          starts_at: new Date("2020-01-01 09:00"),
          ends_at: new Date("2020-01-01 10:00"),
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-01"));
      expect(availabilities["2020-01-01"]).toEqual([]);
    });

    it("several appointments on the same day", async () => {
      await createEvents([
        {
          kind: "appointment",
          starts_at: new Date("2020-01-01 09:00"),
          ends_at: new Date("2020-01-01 09:30"),
        },
        {
          kind: "appointment",
          starts_at: new Date("2020-01-01 09:30"),
          ends_at: new Date("2020-01-01 10:00"),
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-01"));
      expect(availabilities["2020-01-01"]).toEqual([]);
    });
  });

  describe("weekly recurring openings", () => {
    it("weekly recurring are taken into account day 1", async () => {
      await createEvents([
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 09:00"),
          ends_at: new Date("2020-01-01 09:30"),
          weekly_recurring: true,
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-01"));
      expect(availabilities["2020-01-01"]).toEqual(["9:00"]);
    });

    it("weekly recurring are recurring", async () => {
      await createEvents([
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 09:00"),
          ends_at: new Date("2020-01-01 09:30"),
          weekly_recurring: true,
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-08"));
      expect(availabilities["2020-01-08"]).toEqual(["9:00"]);
    });

    it("non weekly recurring are not recurring", async () => {
      await createEvents([
        {
          kind: "opening",
          starts_at: new Date("2020-01-01 09:00"),
          ends_at: new Date("2020-01-01 09:30"),
          weekly_recurring: false,
        },
      ]);
      availabilities = await getAvailabilities(new Date("2020-01-08"));
      expect(availabilities["2020-01-08"]).toEqual([]);
    });
  });
});
