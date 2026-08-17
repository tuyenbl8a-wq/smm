import { config } from "dotenv";
import { serviceName } from "@smm/shared";

config();

console.log(`${serviceName} worker scaffold started. Queue processors will be added in later phases.`);
