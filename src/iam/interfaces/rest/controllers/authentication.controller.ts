import { Body, Controller, HttpCode, HttpStatus, Inject, NotFoundException, Post, UseFilters } from '@nestjs/common';
import { USER_COMMAND_SERVICE } from '../../../domain/services/user-command.service.js';
import type { UserCommandService } from '../../../domain/services/user-command.service.js';
import { USER_QUERY_SERVICE } from '../../../domain/services/user-query.service.js';
import type { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { UserResource } from '../resources/user.resource.js';
import { SignUpResource } from '../resources/sign-up.resource.js';
import { UserResourceFromEntityAssembler } from '../transform/user-resource-from-entity.assembler.js';
import { SignUpCommandFromResourceAssembler } from '../transform/sign-up-command-from-resource.assembler.js';
import { IamExceptionFilter } from '../filters/iam-exception.filter.js';

@Controller('iam/users')
@UseFilters(IamExceptionFilter)
export class AuthenticationController {
  constructor(
    @Inject(USER_COMMAND_SERVICE) private readonly commands: UserCommandService,
    @Inject(USER_QUERY_SERVICE) private readonly queries: UserQueryService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() resource: SignUpResource): Promise<UserResource> {
    const command = SignUpCommandFromResourceAssembler.toCommandFromResource(resource);
    const userId = await this.commands.signUp(command);
    const user = await this.queries.getUserById(new GetUserByIdQuery(userId));
    if (!user) throw new NotFoundException();
    return UserResourceFromEntityAssembler.toResourceFromEntity(user);
  }
}
