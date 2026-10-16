import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationDispatchCommandServiceImpl } from "./application/internal/commandservices/notification-dispatch-command.service.impl.js";
import { DeliveryRequestedEventHandler } from "./application/internal/eventhandlers/delivery-requested.event-handler.js";
import { DeliveryRetriedEventHandler } from "./application/internal/eventhandlers/delivery-retried.event-handler.js";
import { NotificationDispatchQueryServiceImpl } from "./application/internal/queryservices/notification-dispatch-query.service.impl.js";
import { ExternalConsentService } from "./application/internal/outboundservices/acl/external-consent.service.js";
import { EMAIL_SENDING_SERVICE } from "./application/internal/outboundservices/email/email-sending.service.js";
import { TEMPLATE_RESOLVER } from "./application/internal/outboundservices/template/template-resolver.service.js";
import { NotificationContextFacadeImpl } from "./application/acl/notification-context-facade.impl.js";
import { NOTIFICATION_DISPATCH_COMMAND_SERVICE } from "./domain/services/notification-dispatch-command.service.js";
import { NOTIFICATION_DISPATCH_QUERY_SERVICE } from "./domain/services/notification-dispatch-query.service.js";
import { NOTIFICATION_DISPATCH_REPOSITORY } from "./domain/repositories/notification-dispatch.repository.js";
import { LogOnlyEmailSendingAdapter } from "./infrastructure/email/logonly/log-only-email-sending.adapter.js";
import { DispatchRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/dispatch-repository.impl.js";
import { DispatchPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/dispatch-persistence.assembler.js";
import { DispatchOrmEntity } from "./infrastructure/persistence/typeorm/entities/dispatch.orm-entity.js";
import { TemplateResolverAdapter } from "./infrastructure/template/catalog/template-resolver.adapter.js";
import { NOTIFICATION_CONTEXT_FACADE } from "./interfaces/acl/notification-context.facade.js";
import { NotificationDispatchController } from "./interfaces/rest/controllers/notification-dispatch.controller.js";
import { ConsentComplianceModule } from "../consent-compliance/consent-compliance.module.js";

/**
 * Notifications bounded context module (generic subdomain: receiver and actuator).
 *
 * Wires domain ports to application and infrastructure: command/query
 * services, the in-module send handler, TypeORM adapter, template catalog,
 * LogOnly executor (SES/Sendgrid one-line swap) and the real Consent gate
 * (Sprint-04: `mayContactNow` refusals persist as REFUSED history).
  * Publishes NOTIFICATION_CONTEXT_FACADE only (Sprint-01 facade-only precedent):
  * intent requests (R11) and standing/history answers share the one
  * primitives-only seam — never the command port or domain VOs.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Module({
  imports: [TypeOrmModule.forFeature([DispatchOrmEntity]), ConsentComplianceModule],
  controllers: [NotificationDispatchController],
  providers: [
    DispatchPersistenceAssembler,
    DeliveryRequestedEventHandler,
    DeliveryRetriedEventHandler,
    ExternalConsentService,
    { provide: NOTIFICATION_DISPATCH_REPOSITORY, useClass: DispatchRepositoryImpl },
    { provide: NOTIFICATION_DISPATCH_COMMAND_SERVICE, useClass: NotificationDispatchCommandServiceImpl },
    { provide: NOTIFICATION_DISPATCH_QUERY_SERVICE, useClass: NotificationDispatchQueryServiceImpl },
    { provide: EMAIL_SENDING_SERVICE, useClass: LogOnlyEmailSendingAdapter },
    { provide: TEMPLATE_RESOLVER, useClass: TemplateResolverAdapter },
    { provide: NOTIFICATION_CONTEXT_FACADE, useClass: NotificationContextFacadeImpl },
  ],
  exports: [NOTIFICATION_CONTEXT_FACADE],
})
export class NotificationsModule {}
