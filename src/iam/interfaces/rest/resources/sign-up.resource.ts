import { IsEmail, IsNotEmpty } from 'class-validator';

export class SignUpResource {
  @IsNotEmpty() @IsEmail() email: string;
}