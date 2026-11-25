import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginAttemptsService,
    PasswordService,
    SessionService,
  ],
  // SessionService lo usa el guard global registrado en AppModule
  exports: [SessionService, PasswordService],
})
export class AuthModule {}
