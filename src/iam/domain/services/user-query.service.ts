import { GetUserByIdQuery } from "../model/queries/get-user-by-id.query.js";
import { User } from "../model/aggregates/user.aggregate.js"
import { GetSystemRolesByPersonQuery } from "../model/queries/get-system-roles-by-person.query.js";
import { SystemRole } from "../model/valueobjects/system-role.js";
import { GetIdentityHistoryByPersonQuery } from "../model/queries/get-identity-history-by-person.query.js";

export const USER_QUERY_SERVICE = Symbol('USER_QUERY_SERVICE');
export interface UserQueryService { 
  handle(query: GetUserByIdQuery): Promise<User>;
  handle(query: GetSystemRolesByPersonQuery): Promise<SystemRole[]>;
}
