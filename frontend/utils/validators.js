const STUDENT_ID_PATTERN = /^[0-9A-Za-z_-]{4,32}$/;
const MAX_NAME_LENGTH = 64;
const MAX_OPTIONAL_FIELD_LENGTH = 128;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/g;

const normalizeText = (value) => {
  return `${value || ""}`
    .replace(CONTROL_CHAR_PATTERN, "")
    .trim();
};

const validateRegisterForm = (input = {}) => {
  const normalized = {
    studentId: normalizeText(input.studentId),
    name: normalizeText(input.name),
    department: normalizeText(input.department),
    club: normalizeText(input.club)
  };

  const errors = [];

  if (!normalized.studentId) {
    errors.push("学号不能为空");
  } else if (!STUDENT_ID_PATTERN.test(normalized.studentId)) {
    errors.push("学号格式不正确（4-32位，仅支持字母、数字、_、-）");
  }

  if (!normalized.name) {
    errors.push("姓名不能为空");
  } else if (normalized.name.length > MAX_NAME_LENGTH) {
    errors.push("姓名长度不能超过 64");
  }

  if (normalized.department.length > MAX_OPTIONAL_FIELD_LENGTH) {
    errors.push("学院/部门长度不能超过 128");
  }

  if (normalized.club.length > MAX_OPTIONAL_FIELD_LENGTH) {
    errors.push("社团/组织长度不能超过 128");
  }

  return {
    ok: errors.length === 0,
    errors,
    firstError: errors[0] || "",
    normalized
  };
};

module.exports = {
  normalizeText,
  validateRegisterForm
};
