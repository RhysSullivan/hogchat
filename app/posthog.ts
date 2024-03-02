import { getFromCache, setToCache } from "./cache";

// credit to myself https://github.com/RhysSullivan/typelytics/blob/main/packages/posthog-generator/src/bin.ts
export type PostHogEvent = {
    name: string;
    properties: readonly PostHogProperty[];
};
export type PostHogProperty = {
    name: string;
    type: PosthogPropertyType;
};
export type PosthogPropertyType =
    | "DateTime"
    | "String"
    | "Numeric"
    | "Boolean"
    | null;
export function toParams(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obj: Record<string, any>,
    explodeArrays = false
): string {
    if (!obj) {
        return "";
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handleVal(val: any): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        val = typeof val === "object" ? JSON.stringify(val) : val;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return encodeURIComponent(val);
    }

    return Object.entries(obj)
        .filter((item) => item[1] != undefined && item[1] != null)
        .reduce(
            (acc, [key, val]) => {
                /**
                 *  query parameter arrays can be handled in two ways
                 *  either they are encoded as a single query parameter
                 *    a=[1, 2] => a=%5B1%2C2%5D
                 *  or they are "exploded" so each item in the array is sent separately
                 *    a=[1, 2] => a=1&a=2
                 **/
                if (explodeArrays && Array.isArray(val)) {
                    val.forEach((v) => acc.push([key, v]));
                } else {
                    acc.push([key, val]);
                }

                return acc;
            },
            [] as [string, unknown][]
        )
        .map(([key, val]) => `${key}=${handleVal(val)}`)
        .join("&");
}


export type PosthogEventType = {
    id: string;
    name: string;
    owner: null | string;
    description: null | string;
    created_at: string;
    updated_at: null | string;
    updated_by: null | string;
    last_seen_at: string;
    verified: null | boolean;
    verified_at: null | string;
    verified_by: null | string;
    is_action: boolean;
    post_to_slack: boolean;
    tags: string[];
};

export type PostHogEndpoints = {
    event_definitions: {
        queryParams: undefined;
        response: {
            count: number;
            next: null | string;
            previous: null | string;
            results: PosthogEventType[];
        };
    };
    property_definitions: {
        queryParams?: {
            event_names: string[];
            filter_by_event_names: true;
        };
        response: {
            count: number;
            next: string | null;
            previous: string | null;
            results: Array<{
                id: string;
                name: string;
                is_numerical: boolean;
                property_type: PosthogPropertyType;
                tags: (string | null)[];
                is_seen_on_filtered_events: string;
            }>;
        };
    };
};

export function fetchFromPosthog<T extends keyof PostHogEndpoints>(
    endpoint: T,
    options: {
        queryParams?: PostHogEndpoints[T]["queryParams"];
        url?: string;
        posthogToken: string;
        posthogProjectId: string;
    }
) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const url = `https://app.posthog.com/api/projects/${options.posthogProjectId!}/${endpoint}/?${toParams(
        options.queryParams ?? {}
    )}`;
    return fetch(options.url ?? url, {
        method: "GET",
        headers: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            Authorization: `Bearer ${options.posthogToken!}`,
        },
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return (await response.json()) as PostHogEndpoints[T]["response"];
    });
}

async function fetchAllPropertiesOfEvent(eventName: string, opts: {
    posthogToken: string;
    posthogProjectId: string;
}) {
    const result = await fetchFromPosthog("property_definitions", {
        queryParams: {
            event_names: [eventName],
            filter_by_event_names: true,
        },
        posthogToken: opts.posthogToken,
        posthogProjectId: opts.posthogProjectId,
    });
    let next = result.next;
    while (next) {
        const nextResult = await fetchFromPosthog("property_definitions", {
            url: next,
            posthogToken: opts.posthogToken,
            posthogProjectId: opts.posthogProjectId,
        });
        result.results.push(...nextResult.results);
        next = nextResult.next;
    }
    return result;
}

async function fetchAllEventNames(
    opts: {
        posthogToken: string;
        posthogProjectId: string;
    }
) {
    const result = await fetchFromPosthog("event_definitions", opts);
    let next = result.next;
    while (next) {
        const nextResult = await fetchFromPosthog("event_definitions", {
            url: next,
            posthogToken: opts.posthogToken,
            posthogProjectId: opts.posthogProjectId,
        });
        result.results.push(...nextResult.results);
        next = nextResult.next;
    }
    return result;
}


export async function fetchAllEventsWithProperties(
    opts: {
        posthogToken?: string;
        posthogProjectId?: string;
    }
) {
    const cached = await getFromCache("posthog_events_", `${opts.posthogProjectId}${opts.posthogToken}`);
    if (cached) {
        return cached;
    }
    const data = await fetchAllEventNames({
        posthogProjectId: opts.posthogProjectId!,
        posthogToken: opts.posthogToken!,
    });
    const events: PostHogEvent[] = [];

    for await (const event of data.results) {
        const definitions = await fetchAllPropertiesOfEvent(event.name, {
            posthogProjectId: opts.posthogProjectId!,
            posthogToken: opts.posthogToken!,
        });

        events.push({
            name: event.name,
            properties: definitions.results.map((definition) => {
                return {
                    name: definition.name,
                    type: definition.property_type,
                };
            }),
        });
    }
    setToCache("posthog_events_", `${opts.posthogProjectId}${opts.posthogToken}`, events);
    return events;
}