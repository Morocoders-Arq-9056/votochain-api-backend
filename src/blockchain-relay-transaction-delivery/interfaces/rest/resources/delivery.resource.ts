import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { AttemptOutcome } from "../../../domain/model/valueobjects/attempt-outcome.value-object.js";
import { DeliveryStanding } from "../../../domain/model/valueobjects/delivery-standing.value-object.js";

export class AcceptDeliveryResource {
  @IsString()
  @IsNotEmpty()
  contentRef!: string;

  @IsString()
  @IsNotEmpty()
  payerRef!: string;

  @IsString()
  @IsNotEmpty()
  signedProof!: string;
}

export class DeliveryStandingResource {
  @IsString()
  @IsIn(Object.values(DeliveryStanding))
  standing!: string;

  reason!: string | null;
}

export class DeliveryAttemptResource {
  attemptNo!: number;

  @IsString()
  @IsIn(Object.values(AttemptOutcome))
  outcome!: string;

  reason!: string | null;
}
