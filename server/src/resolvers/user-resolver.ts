import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { createQueryBuilder, getConnection } from "typeorm";
import argon2 from "argon2";
import { v4 } from "uuid";

// Entities
import { User } from "../entities/user";
import { Pod } from "../entities/pod";
import { Invite } from "../entities/invite";

// Inputs and Objects
import { UserInput } from "../inputs/user-input";
import { UserResponse } from "../objects/user-response";

// Utils
import { sendEmail } from "../utils/send-email";
import { validateUserInput } from "../utils/validate-user-input";

// Types
import { Context } from "../types/context";

// Constants
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";

@Resolver(User)
export class UserResolver {
  @Authorized()
  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: Context) {
    return User.findOne(req.session.userId);
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("data") data: UserInput,
    @Ctx() { req }: Context
  ): Promise<UserResponse> {
    const { username, password: notHashedPassword, email } = data;

    const errors = validateUserInput(data);
    if (errors) return { errors };

    // Hash password.
    const password = await argon2.hash(notHashedPassword);

    let user;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username,
          email,
          password,
        })
        .returning("*")
        .execute();
      user = result.raw[0];
    } catch (err) {
      return {
        errors: [
          {
            field: `Error code: ${err.code}`,
            message: err.message,
          },
        ],
      };
    }

    // Login after creating user.
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: Context
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes("@")
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
    );
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Username or Email not valid.",
          },
        ],
      };
    }
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "Incorrect Password",
          },
        ],
      };
    }

    // Store session
    req.session.userId = user.id;

    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: Context) {
    return new Promise((resolve) =>
      req.session.destroy((err: Error) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        resolve(true);
      })
    );
  }

  @Mutation(() => Boolean)
  async forgotPassword(@Arg("email") email: string, @Ctx() { redis }: Context) {
    const user = await User.findOne({ where: { email } });
    if (!user) return true; // Invalid email, return true to prevent invalid email access

    const token = v4();
    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    ); // 3 days

    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    );

    return true;
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: Context
  ): Promise<UserResponse> {
    if (newPassword.length <= 2) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "Length must be greater than 2.",
          },
        ],
      };
    }

    const key = FORGET_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "Token expired.",
          },
        ],
      };
    }

    const userIdNum = parseInt(userId);
    const user = await User.findOne(userIdNum);

    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "User no longer exists.",
          },
        ],
      };
    }

    await User.update(
      { id: userIdNum },
      {
        password: await argon2.hash(newPassword),
      }
    );

    await redis.del(key);

    // Log in user after changing password.
    req.session.userId = user.id;

    return { user };
  }

  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: Context) {
    // Show current user their email
    if (req.session.userId === user.id) {
      return user.email;
    }
    // Current user wants to see someone else email
    return "";
  }

  @FieldResolver(() => [Pod])
  async pods(@Ctx() { req }: Context) {
    return createQueryBuilder(Pod, "pod")
      .innerJoin("pod.userPods", "userPod")
      .where("userPod.user.id = :id", { id: req.session.userId })
      .getMany();
  }

  @FieldResolver(() => [Invite])
  async sentInvites(@Ctx() { req }: Context) {
    return createQueryBuilder(Invite, "invite")
      .innerJoinAndSelect("invite.invitee", "invitee")
      .innerJoinAndSelect("invite.pod", "pod")
      .where("invite.inviter.id = :id", { id: req.session.userId })
      .getMany();
  }

  @FieldResolver(() => [Invite])
  async receivedInvites(@Ctx() { req }: Context) {
    return createQueryBuilder(Invite, "invite")
      .innerJoinAndSelect("invite.inviter", "inviter")
      .innerJoinAndSelect("invite.invitee", "invitee")
      .innerJoinAndSelect("invite.pod", "pod")
      .where("invite.invitee.id = :id", { id: req.session.userId })
      .getMany();
  }
}
