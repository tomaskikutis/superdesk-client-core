import {assertNever} from 'core/helpers/typescript-helpers';
import {IFormField, IFormGroup, isIFormGroup, isIFormField} from './interfaces/form';

function getInitialValueForFieldType(fieldConfig: IFormField): {readonly [field: string]: any} {
    const {type, field, component_parameters} = fieldConfig;

    switch (type) {
    case 'text_single_line':
    case 'text_editor3':
        return {[field]: ''};
    case 'vocabulary_single_value':
    case 'content_filter_single_value':
        return {[field]: undefined};
    case 'checkbox':
        return {[field]: false};
    case 'desk_stage_macro':
        return {
            [component_parameters.deskField]: undefined,
            [component_parameters.stageField]: undefined,
            [component_parameters.macroField]: undefined,

        };
    default:
        assertNever(type);
    }
}

function getInitialValuesForForm(form: Array<IFormField | IFormGroup>): {readonly [field: string]: any} {
    return form.map((item) => {
        if (isIFormGroup(item)) {
            return getInitialValues(item);
        } else if (isIFormField(item)) {
            return getInitialValueForFieldType(item);
        } else {
            return assertNever(item);
        }
    })
    .reduce((accumulator, item) => {
        return {...accumulator, ...item};
    }, {});
}

// Some fields need to be initialized automatically.
// For example `false` needs to be sent to the server by default in case of checkbox
// and not `undefined` which might be sent without initialization.
export function getInitialValues(group: IFormGroup): {readonly [key: string]: any} {
    return getInitialValuesForForm(group.form);
}
