import knex from "knex";
import { add, format, eachDayOfInterval, differenceInMinutes } from "date-fns";

// Created constant to store the default format value to get date
// Created constant to store the time slot of the appointments and openings in minutes
const DEFAULT_FORMAT_DATE_STRING = "yyyy-MM-dd";
const SLOT_TIME_MINUTES = 30;

//great query builder, but I would change if I had the opportunity
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

// function created to insert events
// if it is weekly recurring it will add a new entry for the next week with the same time
export const createEvents = async (events) => {
  knexClient
    .transaction(async (trx) => {
      const eventToInsert = [];
      events.forEach((event) => {
        eventToInsert.push({
          kind: event.kind,
          starts_at: new Date(event.starts_at).toISOString(),
          ends_at: new Date(event.ends_at).toISOString(),
          weekly_recurring: event.weekly_recurring ?? null,
        });

        if (event.weekly_recurring === true) {
          eventToInsert.push({
            kind: event.kind,
            starts_at: add(new Date(event.starts_at), {
              weeks: 1,
            }).toISOString(),
            ends_at: add(new Date(event.ends_at), {
              weeks: 1,
            }).toISOString(),
          });
        }
      });

      await knexClient("events").transacting(trx).insert(eventToInsert);
    })
    .then(function (resp) {
      // console.log("Events has been inserted");
    })
    .catch(function (err) {
      console.error(err);
    });
};

const filterOpeningsAndAppointments = (openings, appointments) => {
  let availabilities = openings;
  for (let [date] of Object.entries(openings)) {
    if (appointments[date]) {
      availabilities[date] = openings[date].filter((time) => {
        return !appointments[date].includes(time);
      });
    }
  }
  return availabilities;
};

const formatDateFromFormat = (date, formatParam) => {
  try {
    return format(new Date(date), formatParam ?? DEFAULT_FORMAT_DATE_STRING);
  } catch (e) {
    console.error(e.message);
  }
};

const formatDatesArrayFromFormat = (dates, formatParam) => {
  try {
    return dates.map((date) => {
      return formatDateFromFormat(
        date,
        formatParam ?? DEFAULT_FORMAT_DATE_STRING
      );
    });
  } catch (e) {
    console.error(e.message);
  }
};

const getNextSevenDaysFromDate = (startDay) => {
  try {
    const start = new Date(startDay);
    const end = add(new Date(startDay), { weeks: 1 });
    const nextSevenDays = eachDayOfInterval({ start, end });
    return formatDatesArrayFromFormat(nextSevenDays);
  } catch (e) {
    console.error(e.message);
  }
};

const formatStartAndEndDates = (event) => {
  const startDateTime = format(new Date(event.starts_at), "yyyy-MM-dd H:mm");
  const endDateTime = format(new Date(event.ends_at), "yyyy-MM-dd H:mm");
  const [startDate, startTime] = startDateTime.split(" ");
  const [endDate, endTime] = endDateTime.split(" ");
  return { startDateTime, endDateTime, startDate, startTime, endDate, endTime };
};

/// function to calculate all the interval between times
const addIntervalMinutesSlot = (event) => {
  const {
    startDateTime,
    endDateTime,
    startDate,
    startTime,
  } = formatStartAndEndDates(event);

  const timeSlots = [];

  timeSlots.push(startTime);

  const intervals =
    differenceInMinutes(new Date(endDateTime), new Date(startDateTime)) /
    SLOT_TIME_MINUTES;

  for (let i = 1; i < intervals; i++) {
    const lastSlotTime = timeSlots.slice(-1)[0];

    const lastSlotDate = startDate.concat(" ").concat(lastSlotTime);

    const addThirtyMinutesSlot = add(new Date(lastSlotDate), {
      minutes: SLOT_TIME_MINUTES,
    });

    const formatedSlotTime = format(
      addThirtyMinutesSlot,
      "yyyy-MM-dd'T'H:mm"
    ).split("T")[1];

    timeSlots.push(formatedSlotTime);
  }
  return timeSlots;
};

const findOpeningsFromDate = async (startDay) => {
  return await findEventsFromDateAndKind(startDay, "opening");
};

// I used a native function from sqlite to get the right day
// I've tried to make as simple as possible and added a flexible parameter for 'kind'
// I know it needs to be change if the database changes
const findEventsFromDateAndKind = async (startDay, kind) => {
  const openings = await knexClient("events")
    .where("kind", "=", kind)
    .whereRaw(
      "STRFTIME('%Y-%m-%d',starts_at) >= ? AND STRFTIME('%Y-%m-%d',starts_at) <= ?",
      [startDay, startDay]
    )
    .select();
  return openings;
};

const findAppointmentsFromDate = async (startDay) => {
  return await findEventsFromDateAndKind(startDay, "appointment");
};

const addNextSevenOpenDays = (startDay) => {
  const nextSevenDays = getNextSevenDaysFromDate(startDay);
  nextSevenDays.pop();
  return nextSevenDays.reduce((availability, date) => {
    if (!availability[date]) availability[date] = [];
    return availability;
  }, {});
};

const getOpenings = async (date) => {
  const startDate = format(new Date(date), "yyyy-MM-dd");

  const openings = await findOpeningsFromDate(startDate);

  //added to handle the skeleton test
  if (Object.entries(openings).length === 0) {
    return addNextSevenOpenDays(startDate);
  }

  return openings.reduce((availability, opening) => {
    availability[startDate] = [
      ...(availability[startDate] ?? []),
      addIntervalMinutesSlot(opening),
    ].flat();

    const nextSevenDays = getNextSevenDaysFromDate(startDate).slice(1);
    nextSevenDays.forEach((nextDate) => {
      if (!availability[nextDate]) availability[nextDate] = [];
    });

    const nextWeek = nextSevenDays.splice(-1, 1);
    if (opening.weekly_recurring === true) {
      availability[nextWeek] = availability[startDate];
    } else if (opening.weekly_recurring === false) {
      if (!availability[nextWeek]) availability[nextWeek] = [];
    }

    return availability;
  }, {});
};

const getAppointments = async (date) => {
  const startDay = format(new Date(date), "yyyy-MM-dd");

  const appointments = await findAppointmentsFromDate(startDay);

  return appointments.reduce((availability, appointment) => {
    availability[startDay] = [
      ...(availability[startDay] ?? []),
      addIntervalMinutesSlot(appointment),
    ].flat();

    return availability;
  }, {});
};

export const getAvailabilities = async (date) => {
  const openings = await getOpenings(date);
  const appointments = await getAppointments(date);

  const availabilities = filterOpeningsAndAppointments(openings, appointments);

  return availabilities;
};

/*
SOLUTION:

- I've took the challenge the way it is in the tests, I've tried to not change the object structure and the response

- I was thinking in just add slots time in the events' times and filter the 'open' slots between them

- I've tried to add a hash table implementation, but since it was a long time that I don't work with that type of algorithm,
I've decided to not use in a wrong way and also because I cannot add new lib to help me.

THINGS THAT I WOULD LIKE TO CHANGE:

- for sure create a repository approach for the database, queries and models - Using a ORM

- create a new table 'doctors' and add a key on the events to track better the openings and appointments

- maybe create a different object to handle the date and times better using typescript to insure typing and avoid extra re-formatting

- the skeleton test should be a validation of structure only not its values, I would create a validation just to check a interface of response
and return if it is valid or not
*/

// Thanks for the opportunity to make thing in a different way.
