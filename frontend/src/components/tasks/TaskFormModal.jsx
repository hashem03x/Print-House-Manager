import { CircleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { APP_CONFIG } from '../../config/appConfig.js';
import {
  CUSTOM_PAPER_SIZE,
  DEFAULT_DIMENSION_UNIT,
  DIMENSION_UNITS,
  PAPER_SIZES,
  PAPER_TYPES,
  PAPER_WEIGHTS,
} from '../../constants/paperOptions.js';
import { useI18n } from '../../i18n/useI18n.js';
import { createTask, updateTask } from '../../services/taskApi.js';
import { getErrorMessageKey } from '../../utils/apiErrors.js';
import { formatCurrency, toDateInputValue, todayInputValue } from '../../utils/format.js';
import { computeTotal } from '../../utils/pricing.js';
import {
  DESCRIPTION_MAX_LENGTH,
  mapServerErrors,
  toTaskPayload,
  normalizeNumericInput,
  validateTaskForm,
} from '../../utils/taskValidation.js';
import Button from '../common/Button.jsx';
import FormField, { describedBy } from '../common/FormField.jsx';
import Modal from '../common/Modal.jsx';
import Select from '../common/Select.jsx';

const FIELD_IDS = {
  description: 'task-description',
  taskDate: 'task-date',
  quantity: 'task-quantity',
  price: 'task-price',
  paperType: 'task-paper-type',
  paperSize: 'task-paper-size',
  paperWeight: 'task-paper-weight',
  customWidth: 'task-custom-width',
  customHeight: 'task-custom-height',
  customUnit: 'task-custom-unit',
};
const FIELD_ORDER = [
  'description',
  'taskDate',
  'quantity',
  'price',
  'paperType',
  'paperSize',
  'paperWeight',
  'customWidth',
  'customHeight',
  'customUnit',
];

function initialValues(task) {
  if (!task) {
    return {
      description: '',
      taskDate: todayInputValue(),
      paperType: '',
      paperSize: '',
      paperWeight: '',
      customWidth: '',
      customHeight: '',
      customUnit: DEFAULT_DIMENSION_UNIT,
      quantity: '1',
      price: '',
    };
  }
  return {
    description: task.description,
    taskDate: toDateInputValue(task.taskDate),
    paperType: task.paperType,
    paperSize: task.paperSize,
    // Older tasks may have no weight: the user must pick one when saving.
    paperWeight: task.paperWeight != null ? String(task.paperWeight) : '',
    customWidth: task.customPaperSize?.width != null ? String(task.customPaperSize.width) : '',
    customHeight: task.customPaperSize?.height != null ? String(task.customPaperSize.height) : '',
    // Older custom sizes have no unit: they are millimeters.
    customUnit: task.customPaperSize?.unit ?? DEFAULT_DIMENSION_UNIT,
    // Older tasks have no quantity: they count as 1 (their price is their total).
    quantity: String(task.quantity ?? 1),
    price: String(task.price),
  };
}

/**
 * Add/Edit task dialog. Mount it only while open (the parent renders it
 * conditionally), so each opening starts with fresh state.
 *
 * @param {'add' | 'edit'} mode
 * @param task The task being edited (edit mode).
 * @param onSaved (savedTask) => void — called after the API confirms the save.
 * @param onError (error) => void — called when the save fails for non-validation reasons.
 */
export default function TaskFormModal({ mode = 'add', task, onClose, onSaved, onError }) {
  const { t, locale, numberingSystem } = useI18n();
  const isEdit = mode === 'edit';

  const [values, setValues] = useState(() => initialValues(task));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false); // guards against double submits before re-render

  function focusFirstError(fieldErrors) {
    const first = FIELD_ORDER.find((field) => fieldErrors[field]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }

  function handleChange(event) {
    const { name, value } = event.target;
    const next = { ...values, [name]: value };
    // Leaving "custom" discards the dimensions so stale values are never submitted.
    if (name === 'paperSize' && value !== CUSTOM_PAPER_SIZE) {
      next.customWidth = '';
      next.customHeight = '';
      next.customUnit = DEFAULT_DIMENSION_UNIT;
    }
    // Changing the unit never alters the numbers the user typed.
    setValues(next);
    // After the first submit attempt, re-validate as the user types.
    if (submitted) setErrors(validateTaskForm(next, task));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (savingRef.current) return;

    setSubmitted(true);
    setFormError(null);
    const fieldErrors = validateTaskForm(values, task);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      focusFirstError(fieldErrors);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      const payload = toTaskPayload(values);
      const saved = isEdit ? await updateTask(task.id, payload) : await createTask(payload);
      onSaved(saved);
    } catch (error) {
      const serverFieldErrors = error?.status === 400 ? mapServerErrors(error.errors) : {};
      if (Object.keys(serverFieldErrors).length > 0) {
        setErrors(serverFieldErrors);
        focusFirstError(serverFieldErrors);
      } else {
        setFormError(getErrorMessageKey(error));
        onError?.(error);
      }
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  const error = (field) => (errors[field] ? t(errors[field]) : undefined);
  const hasErrors = Object.keys(errors).length > 0;
  const descriptionLength = values.description.trim().length;
  const isCustomSize = values.paperSize === CUSTOM_PAPER_SIZE;

  // Live total (quantity × unit price), shown only when both inputs are valid.
  const typedQuantity = normalizeNumericInput(values.quantity);
  const typedPrice = normalizeNumericInput(values.price);
  const liveTotal =
    /^\d+$/.test(typedQuantity) && Number(typedQuantity) >= 1 && /^\d+(\.\d{1,2})?$/.test(typedPrice)
      ? computeTotal(Number(typedPrice), Number(typedQuantity))
      : null;

  // Current options, plus the task's own retired value (if any) so it can be kept.
  const optionsWithOriginal = (current, field, labelPrefix) => {
    const options = current.map((value) => ({ value, label: t(`${labelPrefix}.${value}`) }));
    const originalValue = task?.[field];
    if (originalValue && !current.includes(originalValue)) {
      options.push({ value: originalValue, label: t('taskForm.legacyOption', { label: t(`${labelPrefix}.${originalValue}`) }) });
    }
    return options;
  };

  const dimensionField = (field, labelKey, placeholderKey) => (
    <FormField
      id={FIELD_IDS[field]}
      label={t(labelKey)}
      required
      requiredLabel={t('taskForm.required')}
      error={error(field)}
    >
      <div className="input-unit">
        <input
          id={FIELD_IDS[field]}
          name={field}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          className="input num input--numeric"
          required
          placeholder={t(placeholderKey)}
          value={values[field]}
          onChange={handleChange}
          aria-invalid={Boolean(errors[field]) || undefined}
          aria-describedby={[describedBy(FIELD_IDS[field], undefined, error(field)), 'custom-size-hint']
            .filter(Boolean)
            .join(' ')}
        />
        <span className="input-unit__label" aria-hidden="true">
          {t(`units.${values.customUnit}`)}
        </span>
      </div>
    </FormField>
  );

  return (
    <Modal
      isOpen
      titleId="task-form-title"
      title={t(isEdit ? 'taskForm.editTitle' : 'taskForm.addTitle')}
      description={t(isEdit ? 'taskForm.editSubtitle' : 'taskForm.addSubtitle')}
      closeLabel={t('taskForm.close')}
      onClose={onClose}
      busy={isSaving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {t('taskForm.cancel')}
          </Button>
          <Button type="submit" form="task-form" loading={isSaving}>
            {t(isSaving ? 'taskForm.saving' : 'taskForm.save')}
          </Button>
        </>
      }
    >
      <form id="task-form" className="task-form" noValidate onSubmit={handleSubmit}>
        {(formError || (submitted && hasErrors)) && (
          <div className="form-alert" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <p>{t(formError ?? 'validation.summary')}</p>
          </div>
        )}

        <p className="task-form__note">{t('taskForm.requiredNote')}</p>

        <FormField
          id={FIELD_IDS.description}
          label={t('taskForm.description')}
          required
          requiredLabel={t('taskForm.required')}
          hint={t('taskForm.descriptionHint')}
          error={error('description')}
          aside={
            <span
              className={`form-field__counter num ${descriptionLength > DESCRIPTION_MAX_LENGTH ? 'is-over' : ''}`}
              aria-hidden="true"
            >
              {t('taskForm.characterCount', { count: descriptionLength, max: DESCRIPTION_MAX_LENGTH })}
            </span>
          }
        >
          <textarea
            id={FIELD_IDS.description}
            name="description"
            className="input textarea"
            rows={3}
            dir="auto"
            required
            placeholder={t('taskForm.descriptionPlaceholder')}
            value={values.description}
            onChange={handleChange}
            data-autofocus
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={describedBy(FIELD_IDS.description, t('taskForm.descriptionHint'), error('description'))}
          />
        </FormField>

        <div className="task-form__row">
          <FormField
            id={FIELD_IDS.taskDate}
            label={t('taskForm.taskDate')}
            required
            requiredLabel={t('taskForm.required')}
            hint={t('taskForm.taskDateHint')}
            error={error('taskDate')}
          >
            <input
              id={FIELD_IDS.taskDate}
              name="taskDate"
              type="date"
              className="input"
              required
              value={values.taskDate}
              onChange={handleChange}
              aria-invalid={Boolean(errors.taskDate) || undefined}
              aria-describedby={describedBy(FIELD_IDS.taskDate, t('taskForm.taskDateHint'), error('taskDate'))}
            />
          </FormField>

          <FormField
            id={FIELD_IDS.quantity}
            label={t('taskForm.quantity')}
            required
            requiredLabel={t('taskForm.required')}
            hint={t('taskForm.quantityHint')}
            error={error('quantity')}
          >
            <input
              id={FIELD_IDS.quantity}
              name="quantity"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              dir="ltr"
              className="input num input--numeric"
              required
              value={values.quantity}
              onChange={handleChange}
              aria-invalid={Boolean(errors.quantity) || undefined}
              aria-describedby={describedBy(FIELD_IDS.quantity, t('taskForm.quantityHint'), error('quantity'))}
            />
          </FormField>
        </div>

        <div className="task-form__row pricing-row">
          <FormField
            id={FIELD_IDS.price}
            label={`${t('taskForm.price')} (${APP_CONFIG.currency})`}
            required
            requiredLabel={t('taskForm.required')}
            hint={t('taskForm.priceHint')}
            error={error('price')}
          >
            {/* Text + inputMode so Arabic-Indic digits can be typed; normalized on submit. */}
            <input
              id={FIELD_IDS.price}
              name="price"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="input num input--numeric"
              required
              placeholder={t('taskForm.pricePlaceholder')}
              value={values.price}
              onChange={handleChange}
              aria-invalid={Boolean(errors.price) || undefined}
              aria-describedby={describedBy(FIELD_IDS.price, t('taskForm.priceHint'), error('price'))}
            />
          </FormField>

          <div className="form-field">
            <span className="form-field__label" id="task-total-label">
              {t('taskForm.total')}
            </span>
            <output
              id="task-total"
              className="total-output num"
              aria-labelledby="task-total-label"
              aria-live="polite"
              htmlFor={`${FIELD_IDS.quantity} ${FIELD_IDS.price}`}
            >
              {liveTotal === null ? '—' : formatCurrency(liveTotal, locale, numberingSystem)}
            </output>
            <p className="form-field__hint">{t('taskForm.totalHint')}</p>
          </div>
        </div>

        <div className="task-form__row task-form__row--3">
          <FormField
            id={FIELD_IDS.paperType}
            label={t('taskForm.paperType')}
            required
            requiredLabel={t('taskForm.required')}
            error={error('paperType')}
          >
            <Select
              id={FIELD_IDS.paperType}
              name="paperType"
              required
              placeholder={t('taskForm.paperTypePlaceholder')}
              options={optionsWithOriginal(PAPER_TYPES, 'paperType', 'paperTypes')}
              value={values.paperType}
              onChange={handleChange}
              invalid={Boolean(errors.paperType)}
              aria-describedby={describedBy(FIELD_IDS.paperType, undefined, error('paperType'))}
            />
          </FormField>

          <FormField
            id={FIELD_IDS.paperSize}
            label={t('taskForm.paperSize')}
            required
            requiredLabel={t('taskForm.required')}
            error={error('paperSize')}
          >
            <Select
              id={FIELD_IDS.paperSize}
              name="paperSize"
              required
              placeholder={t('taskForm.paperSizePlaceholder')}
              options={optionsWithOriginal(PAPER_SIZES, 'paperSize', 'paperSizes')}
              value={values.paperSize}
              onChange={handleChange}
              invalid={Boolean(errors.paperSize)}
              aria-describedby={describedBy(FIELD_IDS.paperSize, undefined, error('paperSize'))}
            />
          </FormField>

          <FormField
            id={FIELD_IDS.paperWeight}
            label={t('taskForm.paperWeight')}
            required
            requiredLabel={t('taskForm.required')}
            error={error('paperWeight')}
          >
            <Select
              id={FIELD_IDS.paperWeight}
              name="paperWeight"
              required
              placeholder={t('taskForm.paperWeightPlaceholder')}
              options={PAPER_WEIGHTS.map((value) => ({ value: String(value), label: t(`paperWeights.${value}`) }))}
              value={values.paperWeight}
              onChange={handleChange}
              invalid={Boolean(errors.paperWeight)}
              aria-describedby={describedBy(FIELD_IDS.paperWeight, undefined, error('paperWeight'))}
            />
          </FormField>
        </div>

        {isCustomSize && (
          <fieldset className="custom-size">
            <legend className="custom-size__legend">{t('taskForm.customSizeTitle')}</legend>
            <p id="custom-size-hint" className="custom-size__hint">
              {t('taskForm.customSizeHint')}
            </p>
            <div className="custom-size__grid">
              {dimensionField('customWidth', 'taskForm.width', 'taskForm.widthPlaceholder')}
              {dimensionField('customHeight', 'taskForm.height', 'taskForm.heightPlaceholder')}
              <FormField
                id={FIELD_IDS.customUnit}
                label={t('taskForm.unit')}
                required
                requiredLabel={t('taskForm.required')}
                error={error('customUnit')}
              >
                <Select
                  id={FIELD_IDS.customUnit}
                  name="customUnit"
                  required
                  options={Object.keys(DIMENSION_UNITS).map((unit) => ({
                    value: unit,
                    label: t('units.option', { name: t(`unitNames.${unit}`), unit: t(`units.${unit}`) }),
                  }))}
                  value={values.customUnit}
                  onChange={handleChange}
                  invalid={Boolean(errors.customUnit)}
                  aria-describedby={[describedBy(FIELD_IDS.customUnit, undefined, error('customUnit')), 'custom-size-hint']
                    .filter(Boolean)
                    .join(' ')}
                />
              </FormField>
            </div>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
