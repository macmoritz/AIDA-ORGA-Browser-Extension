function getMinutesBetweenDates(start: Date, end: Date): number {
    const diff = end.getTime() - start.getTime();

    return Math.floor(diff / 60000);
}

Date.prototype.toTwoDigitTimeString = function (): string {
    return this.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

Date.prototype.toTwoDigitTimedeltaString = function (): string {
    return `${this.getUTCHours().toString().padStart(2, "0")}:${this.getUTCMinutes().toString().padStart(2, "0")}`;
}

declare global {
    interface Date {
        toTwoDigitTimeString(): string;
        toTwoDigitTimedeltaString(): string;
    }
}

class Time extends Date {
    constructor(hours: number, minutes?: number) {
        super(0);

        super.setHours(hours);
        if (minutes) {
            super.setMinutes(minutes);
        }
    }
}

class CoreTime {
    private times: Time[];

    constructor(defaultTime?: Time) {
        this.times = [];
        if (defaultTime) {
            this.times = new Array(5).fill(defaultTime);
        }
    }

    setDayCoreTime(day: number, time: Time) {
        if (day >= this.times.length) {
            return;
        }
        this.times[day] = time;
    }

    getDayCoreTime(): Date | null {
        const day = (new Date().getDay() + 6) % 7;
        if (day >= this.times.length) {
            return null;
        }
        let today = new Date();
        today.setHours(this.times[day].getHours());
        today.setMinutes(this.times[day].getMinutes());
        today.setSeconds(0);

        return today;
    }
}

interface Booking {
    Date: string;
    TypeInfo: number;
    caid: string;
    day: number;
    fjid: string;
}

interface Times {
    timeLineActive: boolean[];
    timeLineId: string[];
    title: string[];
    type: string[];
    values: Record<string, [number, number]>;
}

class BookingsLastSevenDays {
    bookings: Booking[];
    times: Times[];

    static url = "../rs/de.aidaorga.aida.ewas.taims/rpc/buchungen_7Tage";

    constructor(data?: Partial<BookingsLastSevenDays>) {
        this.bookings = data?.bookings ?? [];
        this.times = data?.times ?? [];
    }

    get todayStartingTime(): Date | null {
        const today = new Date();
        const todayBookings = this.bookings
            .map(booking => new Date(booking.Date))
            .filter(date =>
                date.getFullYear() === today.getFullYear() &&
                date.getMonth() === today.getMonth() &&
                date.getDate() === today.getDate()
            );

        if (todayBookings.length == 0) {
            return null;
        }

        return new Date(Math.min(...todayBookings.map(date => date.getTime())));
    }

    getTodayFinishingTimes(tls: TrafficLightStatus, coreTime: CoreTime): FinishingTimes | null {
        let startingTime = this.todayStartingTime;
        console.log(`startingTime ${startingTime}`);
        if (startingTime == null) {
            return null;
        }

        const dateKey = new Date().toISOString().slice(0, 10);
        const values = this.times[0].values[dateKey];
        console.log(`values ${values}`);
        if (!values) {
            return null;
        }

        const requiredIndex = this.times[0].title.findIndex((key) => key == "Soll");
        if (requiredIndex == -1) {
            return null;
        }

        let finishingTimes: FinishingTimes = { normal: new Date(startingTime), earliest: new Date(startingTime), savedTimeDiff: Duration.fromMinutes(0), newSavedTime: Duration.fromMinutes(0) };
        let requiredMinutes = values[requiredIndex];
        console.log(`requiredMinutes ${requiredMinutes}`);
        finishingTimes.normal.setMinutes(finishingTimes.normal.getMinutes() + requiredMinutes);

        const currentValueIndex = this.times[0].title.findIndex((key) => key == "Ist");
        if (currentValueIndex != -1) {
            let minutesBooked = values[currentValueIndex];
            let minutesWorked: number = getMinutesBetweenDates(startingTime, new Date());

            if (minutesBooked > minutesWorked) {
                let diff = minutesBooked - minutesWorked;
                finishingTimes.normal.setMinutes(finishingTimes.normal.getMinutes() - diff);
            }
        }

        // TODO: Improve and centralize break calculations
        finishingTimes.normal.setMinutes(finishingTimes.normal.getMinutes() + 30);

        const savedIndex = this.times[0].title.findIndex((key) => key == "Soll");
        if (savedIndex == -1) {
            return finishingTimes;
        }
        finishingTimes.earliest = new Date(finishingTimes.normal);
        let minutesSaved = tls.Accounts[0].values[dateKey][savedIndex];
        if (minutesSaved) {
            finishingTimes.earliest.setMinutes(finishingTimes.earliest.getMinutes() - minutesSaved);
        }

        let currentCoreTime = coreTime.getDayCoreTime();
        if (currentCoreTime && finishingTimes.earliest < currentCoreTime) {
            finishingTimes.earliest = currentCoreTime;
        }

        finishingTimes.savedTimeDiff = Duration.fromDates(finishingTimes.normal, finishingTimes.earliest);
        finishingTimes.newSavedTime = Duration.fromMinutes(minutesSaved);
        finishingTimes.newSavedTime = finishingTimes.newSavedTime.add(finishingTimes.savedTimeDiff);

        return finishingTimes;
    }
}

interface Account {
    timeLineActive: boolean[];
    timeLineId: string[];
    title: string[];
    type: string[];
    values: Record<string, [number]>;
}

class TrafficLightStatus {
    Trafficlightstatus: number;
    Accounts: Account[];

    static url = "../rs/de.aidaorga.aida.ewas.taims/rpc/trafficlightstatus";

    constructor(data?: Partial<TrafficLightStatus>) {
        this.Trafficlightstatus = data?.Trafficlightstatus ?? -1;
        this.Accounts = data?.Accounts ?? [];
    }
}

interface ApiResponse<ApiResponseType> {
    Data: ApiResponseType;
}

class Duration {
    private readonly milliseconds: number;

    constructor(milliseconds: number) {
        this.milliseconds = milliseconds;
    }

    static fromDates(start: Date, end: Date) {
        return new Duration(end.getTime() - start.getTime());
    }

    static fromMinutes(minutes: number): Duration {
        return new Duration(minutes * 60_000);
    }

    get sign(): "-" | "" | "+" {
        return this.milliseconds === 0 ? "" : this.milliseconds > 0 ? "+" : "-";
    }

    add(other: Duration): Duration {
        return new Duration(this.milliseconds + other.milliseconds);
    }

    get hours(): number {
        return Math.floor(Math.abs(this.milliseconds) / 3_600_000);
    }

    get minutes(): number {
        return Math.floor(Math.abs(this.milliseconds) / 60_000) % 60;
    }

    toString(): string {
        return `${this.sign}${String(this.hours).padStart(2, "0")}:${String(this.minutes).padStart(2, "0")}`;
    }
}


interface FinishingTimes {
    normal: Date;
    earliest: Date;

    savedTimeDiff: Duration;
    newSavedTime: Duration;
}

async function getDataFromApi<ApiResponseType>(url: string): Promise<ApiResponseType> {
    const sessionId0 = localStorage.getItem("ngStorage-SessionID0");
    if (sessionId0 == null) {
        throw Error("SessionId unknown");
    }

    const sessionId = JSON.parse(sessionId0);

    let json = await fetch(url, {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "accept-language": "de-DE",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "x-ewas-sessionid": sessionId
        },
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            return response.text();
        })
        .then((body) => body.replace("while(1);", ""));

    const apiResponse: ApiResponse<ApiResponseType> = JSON.parse(json) as ApiResponse<ApiResponseType>;

    return apiResponse.Data;
}

async function patchAida() {
    let status;
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts++ < maxAttempts) {
        status = document.querySelector("div[role=\"status\"]")

        if (status?.textContent === "Geladen") {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (status?.textContent !== "Geladen") {
        throw Error("Page did not finish loading");
    }

    if (!location.hash.includes("dashboard")) {
        return;
    }

    const coreTime: CoreTime = new CoreTime(new Time(15, 30));
    coreTime.setDayCoreTime(4, new Time(12));

    const data = new BookingsLastSevenDays(await getDataFromApi<BookingsLastSevenDays>(BookingsLastSevenDays.url));
    console.log("BookingsLastSevenDays", data);

    const dataTrafficLightStatus = new TrafficLightStatus(await getDataFromApi<TrafficLightStatus>(TrafficLightStatus.url));
    console.log("TrafficLightStatus", dataTrafficLightStatus);


    let dashboardElement = document.querySelector(".dashboard");
    if (!dashboardElement) {
        throw Error("Dashboard not found");
    }

    let firstRowElement = dashboardElement.firstElementChild;
    if (!firstRowElement) {
        throw Error("First row of dashboard grid not found");
    }
    let columnElements = firstRowElement.querySelectorAll("div.column");
    if (!columnElements || columnElements.length < 1) {
        throw Error("First column of first row in dashboard grid not found");
    }
    if (columnElements[1].firstElementChild) {
        columnElements[0].appendChild(columnElements[1].firstElementChild.cloneNode(true));
    }
    let columnTitleElement = columnElements[0].querySelectorAll("h3.ng-scope > span")[0];
    let columnContentElement = columnElements[0].querySelectorAll(".dashboard-widget")[0];

    columnTitleElement.innerHTML = "Feierabend";
    columnContentElement.innerHTML = "";

    const finishingTimes = data.getTodayFinishingTimes(dataTrafficLightStatus, coreTime);

    if (finishingTimes != null) {
        let p1 = document.createElement("p");
        p1.textContent = `Regulärer Feierabend: ${finishingTimes.normal.toTwoDigitTimeString()} Uhr`;
        columnContentElement.appendChild(p1);

        let hr = document.createElement("hr");
        columnContentElement.appendChild(hr);

        let p3 = document.createElement("p");
        p3.textContent = `Frühester Feierabend: ${finishingTimes.earliest.toTwoDigitTimeString()} Uhr`;
        columnContentElement.appendChild(p3);

        let p4 = document.createElement("p");
        p4.textContent = `Anpassung Flexzeit: ${finishingTimes.savedTimeDiff.toString()} Stunden`;
        columnContentElement.appendChild(p4);

        let p5 = document.createElement("p");
        p5.textContent = `Flexzeit morgen: ${finishingTimes.newSavedTime.toString()} Stunden`;
        columnContentElement.appendChild(p5);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchAida);
} else {
    patchAida();
}

