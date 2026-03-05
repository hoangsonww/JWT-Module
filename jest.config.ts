import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/tests"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: {
    "^@paralleldrive/cuid2$": "<rootDir>/src/tests/__mocks__/cuid2.ts",
  },
  collectCoverageFrom: [
    "src/auth/**/*.ts",
    "src/api/**/*.ts",
    "!src/**/*.d.ts",
  ],
};

export default config;
