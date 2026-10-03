import { IsString } from "class-validator";

export class CastVoteResource {
  @IsString() authorizationId: string;
  @IsString() choice: string;
}
