import { userRouter } from "@/server/api/routers/user";
import { subscriptionRouter } from "@/server/api/routers/subscription";
import { propertyRouter } from "@/server/api/routers/property";
import { meterRouter } from "@/server/api/routers/meter";
import { readingRouter } from "@/server/api/routers/reading";
import { paymentRouter } from "@/server/api/routers/payment";
import { tariffRouter } from "@/server/api/routers/tariff";
import { maintenanceRouter } from "@/server/api/routers/maintenance";
import { todoRouter } from "@/server/api/routers/todo";
import { chatRouter } from "@/server/api/routers/chat";
import { wifiRouter } from "@/server/api/routers/wifi";
import { commonFeeRouter } from "@/server/api/routers/common-fee";
import { propertyTaxRouter } from "@/server/api/routers/property-tax";
import { documentRouter } from "@/server/api/routers/document";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
  user: userRouter,
  subscription: subscriptionRouter,
  property: propertyRouter,
  meter: meterRouter,
  reading: readingRouter,
  payment: paymentRouter,
  tariff: tariffRouter,
  maintenance: maintenanceRouter,
  todo: todoRouter,
  chat: chatRouter,
  wifi: wifiRouter,
  commonFee: commonFeeRouter,
  propertyTax: propertyTaxRouter,
  document: documentRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
