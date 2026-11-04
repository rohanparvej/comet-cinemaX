// Shared toJSON: expose _id as `id`, hide __v and password hash
export function applyJson(schema) {
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.hashed_password;
      return ret;
    },
  });
}
