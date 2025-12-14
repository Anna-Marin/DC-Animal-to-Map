"use client";

import { useAppDispatch, useAppSelector } from "../../lib/hooks";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { RootState } from "../../lib/store";
import { IUserProfileUpdate } from "../../lib/interfaces";
import { profile, updateUserProfile } from "../../lib/slices/authSlice";

const title = "Security";

//@ts-ignore
const renderError = (type: LiteralUnion<keyof RegisterOptions, string>) => {
  const style =
    "absolute left-5 top-5 translate-y-full w-48 px-2 py-1 bg-gray-700 rounded-lg text-center text-white text-sm after:content-[''] after:absolute after:left-1/2 after:bottom-[100%] after:-translate-x-1/2 after:border-8 after:border-x-transparent after:border-t-transparent after:border-b-gray-700";
  switch (type) {
    case "required":
      return <div className={style}>This field is required.</div>;
    case "minLength":
    case "maxLength":
      return (
        <div className={style}>
          Your password must be between 8 and 64 characters long.
        </div>
      );
    case "match":
      return <div className={style}>Your passwords do not match.</div>;
    default:
      return <></>;
  }
};

export default function Security() {
  const dispatch = useAppDispatch();
  const currentProfile = useAppSelector((state: RootState) => profile(state));

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const schema = {
    original: {
      required: currentProfile.password,
      minLength: 8,
      maxLength: 64,
    },
    password: { required: false, minLength: 8, maxLength: 64 },
    confirmation: { required: false },
  };

  async function submit(values: any) {
    let newProfile = {} as IUserProfileUpdate;
    if (
      (!currentProfile.password && !values.original) ||
      (currentProfile.password && values.original)
    ) {
      if (values.original) newProfile.original = values.original;
      if (values.password && values.password !== values.original) {
        newProfile.password = values.password;
        await dispatch(updateUserProfile(newProfile));
      }
    }
  }

  return (
    <div className="shadow sm:overflow-hidden sm:rounded-md max-w-lg">
      <form onSubmit={handleSubmit(submit)} validation-schema="schema">
        <div className="space-y-6 bg-white py-6 px-4 sm:p-6">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              {title}
            </h3>
            {!currentProfile.password ? (
              <p className="mt-1 text-sm text-gray-500">
                Secure your account by adding a password. Any changes will require you to enter your original password (if set).
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-500">
                Update your password below. Any changes will require you to enter your original password.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="original"
              className="block text-sm font-medium text-gray-700"
            >
              Original password
            </label>
            <div className="mt-1 group relative inline-block w-full">
              <input
                {...register("original", schema.original)}
                id="original"
                name="original"
                type="password"
                autoComplete="password"
                className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm"
              />
              {errors.original && renderError(errors.original.type)}
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              New password
            </label>
            <div className="mt-1 group relative inline-block w-full">
              <input
                {...register("password", schema.password)}
                id="password"
                name="password"
                type="password"
                autoComplete="password"
                className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm"
              />
              {errors.password && renderError(errors.password.type)}
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="confirmation"
              className="block text-sm font-medium text-gray-700"
            >
              Repeat new password
            </label>
            <div className="mt-1 group relative inline-block w-full">
              <input
                {...register("confirmation", {
                  ...schema.confirmation,
                  validate: {
                    match: (val) => watch("password") == val,
                  },
                })}
                id="confirmation"
                name="confirmation"
                type="password"
                autoComplete="confirmation"
                className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm"
              />
              {errors.confirmation && renderError(errors.confirmation.type)}
            </div>
          </div>
        </div>
        <div className="py-3 pb-6 text-right sm:px-6">
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent bg-rose-500 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
