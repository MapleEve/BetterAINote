import {
    rebuildSearchIndexForAllUsers,
    rebuildSearchIndexForUser,
} from "./rebuild";

const userArg = process.argv.find((arg) => arg.startsWith("--user="));
const userId = userArg ? userArg.slice("--user=".length).trim() : "";

const result = userId
    ? await rebuildSearchIndexForUser(userId)
    : await rebuildSearchIndexForAllUsers();

console.log(JSON.stringify(result, null, 2));
