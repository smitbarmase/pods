import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { createQueryBuilder, getConnection } from "typeorm";

// Entities
import { User } from "../entities/user";
import { Pod } from "../entities/pod";
import { Story } from "../entities/story";
import { UserPod } from "../entities/user-pod";
import { Invite } from "../entities/invite";

// Inputs and Objects
import { PodResponse } from "../objects/pod-response";
import { PodInput } from "../inputs/pod-input";

// Types
import { Context } from "../types/context";

@Resolver(Pod)
export class PodResolver {
  @Query(() => Pod, { nullable: true })
  pod(@Arg("id", () => Int) id: number, @Ctx() { req }: Context) {
    return getConnection()
      .createQueryBuilder(Pod, "pod")
      .innerJoin("pod.userPods", "userPod")
      .where("pod.id = :podId", { podId: id })
      .andWhere("userPod.user.id = :userId", { userId: req.session.userId })
      .getOne();
  }

  @Mutation(() => PodResponse)
  async createPod(
    @Arg("data") data: PodInput,
    @Ctx() { req }: Context
  ): Promise<PodResponse> {
    const { name } = data;

    // Name validation
    if (name.length <= 2) {
      return {
        errors: [
          {
            field: "name",
            message: "Name should be more than 2 characters.",
          },
        ],
      };
    }

    let pod;
    try {
      // Creates new pod
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(Pod)
        .values({
          name,
        })
        .returning("*")
        .execute();

      pod = result.raw[0];

      await getConnection()
        .createQueryBuilder()
        .insert()
        .into(UserPod)
        .values({
          pod: { id: pod.id },
          user: { id: req.session.userId },
          isAdmin: true,
        })
        .returning("*")
        .execute();
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

    return { pod };
  }

  @Authorized("ADMIN")
  @Mutation(() => Boolean)
  async inviteToPod(
    @Arg("podId", () => Int) podId: number,
    @Arg("username", () => String) username: string,
    @Arg("asAdmin", () => Boolean) asAdmin: boolean,
    @Ctx() { req }: Context
  ): Promise<Boolean> {
    try {
      const user = await getConnection()
        .createQueryBuilder(User, "user")
        .where("user.username = :username", { username })
        .getOne();

      if (user) {
        await getConnection()
          .createQueryBuilder()
          .insert()
          .into(Invite)
          .values({
            invitee: { id: user.id },
            inviter: { id: req.session.userId },
            pod: { id: podId },
            asAdmin,
          })
          .execute();
      }
    } catch (e) {
      console.log(e);
      return false;
    }
    return true;
  }

  @Authorized("ADMIN")
  @Mutation(() => Boolean)
  async uninviteToPod(
    @Arg("podId", () => Int) podId: number,
    @Arg("username", () => String) username: string,
    @Ctx() { req }: Context
  ): Promise<Boolean> {
    try {
      const user = await getConnection()
        .createQueryBuilder(User, "user")
        .where("user.username = :username", { username })
        .getOne();

      if (user) {
        const inviteeId = user.id;
        await getConnection()
          .createQueryBuilder(Invite, "invite")
          .innerJoin("invite.invitee", "invitee")
          .innerJoin("invite.inviter", "inviter")
          .innerJoin("invite.pod", "pod")
          .where("invitee.id = :inviteeId", { inviteeId })
          .andWhere("pod.id = :podId", { podId })
          .andWhere("inviter.id = :inviterId", {
            inviterId: req.session.userId,
          })
          .delete()
          .execute();
      }
    } catch (e) {
      return false;
    }
    return true;
  }

  @Mutation(() => Boolean)
  async cancelInvite(
    @Arg("podId", () => Int) podId: number,
    @Ctx() { req }: Context
  ): Promise<Boolean> {
    try {
      await getConnection()
        .createQueryBuilder(Invite, "invite")
        .innerJoin("invite.invitee", "invitee")
        .innerJoin("invite.pod", "pod")
        .where("invitee.id = :id", { id: req.session.userId })
        .andWhere("pod.id = :podId", { podId })
        .delete()
        .execute();
    } catch (e) {
      console.log(e);
      return false;
    }
    return true;
  }

  @Mutation(() => Boolean)
  async removeFromPod(
    @Arg("podId", () => Int) podId: number,
    @Arg("userId", () => Int) userId: number,
    @Ctx() { req }: Context
  ): Promise<Boolean> {
    // Check if request is from  admin of a pod and he hase joined the pod.
    const userPod = await getConnection()
      .createQueryBuilder(UserPod, "userPod")
      .where("userPod.pod.id = :podId", { podId })
      .andWhere("userPod.user.id = :userId", { userId: req.session.userId })
      .andWhere("userPod.isAdmin = :isAdmin", { isAdmin: true })
      .getOne();

    if (!userPod) return false;

    try {
      await getConnection()
        .createQueryBuilder(UserPod, "userPod")
        .innerJoin("userPod.user", "user")
        .innerJoin("userPod.pod", "pod")
        .where("userPod.pod.id = :podId", { podId: podId })
        .andWhere("userPod.user.id = :userId", { userId: userId })
        .delete()
        .execute();
    } catch (e) {
      return false;
    }
    return true;
  }

  @Mutation(() => Boolean)
  async leavePod(
    @Arg("podId", () => Int) podId: number,
    @Ctx() { req }: Context
  ): Promise<Boolean> {
    try {
      await getConnection()
        .createQueryBuilder(UserPod, "userPod")
        .innerJoin("userPod.user", "user")
        .innerJoin("userPod.pod", "pod")
        .where("pod.id = :podId", { podId: podId })
        .andWhere("user.id = :userId", { userId: req.session.userId })
        .delete()
        .execute();
    } catch (e) {
      console.log(e);
      return false;
    }
    return true;
  }

  @Mutation(() => Boolean)
  async joinPod(
    @Arg("podId", () => Int) podId: number,
    @Ctx() { req }: Context
  ): Promise<Boolean> {
    const invite = await getConnection()
      .createQueryBuilder(Invite, "invite")
      .where("invite.pod.id = :podId", { podId })
      .andWhere("invite.invitee.id = :userId", { userId: req.session.userId })
      .getOne();

    if (!invite) return false;

    try {
      await getConnection()
        .createQueryBuilder(Invite, "invite")
        .innerJoin("invite.invitee", "invitee")
        .innerJoin("invite.pod", "pod")
        .where("invitee.id = :id", { id: req.session.userId })
        .andWhere("pod.id = :podId", { podId })
        .delete()
        .execute();
      await getConnection()
        .createQueryBuilder()
        .insert()
        .into(UserPod)
        .values({
          user: { id: req.session.userId },
          pod: { id: podId },
          isAdmin: invite.asAdmin,
        })
        .execute();
    } catch (e) {
      console.log(e);
      return false;
    }
    return true;
  }

  @Mutation(() => Boolean)
  async deletePod(@Arg("podId", () => Int) podId: number): Promise<Boolean> {
    try {
      await getConnection()
        .createQueryBuilder()
        .delete()
        .from(Pod)
        .where({ id: podId })
        .execute();
    } catch (e) {
      return false;
    }
    return true;
  }

  @FieldResolver(() => [User])
  admins(@Root() pod: Pod) {
    return createQueryBuilder(User, "user")
      .innerJoin("user.userPods", "userPod")
      .where("userPod.pod.id = :id", { id: pod.id })
      .andWhere("userPod.isAdmin = :isAdmin", { isAdmin: true })
      .getMany();
  }

  @FieldResolver(() => [User])
  members(@Root() pod: Pod) {
    return createQueryBuilder(User, "user")
      .innerJoin("user.userPods", "userPod")
      .where("userPod.pod.id = :id", { id: pod.id })
      .andWhere("userPod.isAdmin = :isAdmin", { isAdmin: false })
      .getMany();
  }

  @FieldResolver(() => [Story])
  stories(@Root() pod: Pod) {
    // Returns all the stories, but not pod, having pod.id
    return createQueryBuilder(Story, "story")
      .innerJoin("story.pod", "pod")
      .where("pod.id = :id", { id: pod.id })
      .orderBy("story.rank")
      .getMany();
  }
}
