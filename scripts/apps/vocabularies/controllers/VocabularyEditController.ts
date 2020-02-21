import _ from 'lodash';
import {MEDIA_TYPES, MEDIA_TYPE_KEYS, VOCABULARY_SELECTION_TYPES, IVocabularySelectionTypes} from '../constants';
import {gettext} from 'core/utils';
import {getFields} from 'apps/fields';
import {IVocabulary} from 'superdesk-api';
import {IScope as IScopeConfigController} from './VocabularyConfigController';

VocabularyEditController.$inject = [
    '$scope',
    'notify',
    'api',
    'vocabularies',
    'metadata',
    'cvSchema',
    'relationsService',
    '$timeout',
];

interface IScope extends IScopeConfigController {
    setFormDirty: () => void;
    newItemTemplate: any;
    idRegex: string;
    vocabulary: IVocabulary;
    selectionTypes: IVocabularySelectionTypes;
    closeVocabulary: () => void;
    updateVocabulary: (result: any) => void;
    issues: Array<any> | null;
    _errorUniqueness: boolean;
    errorMessage: string;
    save: () => void;
    requireAllowedTypesSelection: () => void;
    addItem: () => void;
    cancel: () => void;
    model: any;
    schema: any;
    schemaFields: Array<any>;
    itemsValidation: { valid: boolean };
    customFieldTypes: Array<{id: string, label: string}>;
    setCustomFieldConfig: (config: any) => void;
    editForm: any;
    tab: 'general' | 'items';
    setTab: (tab: IScope['tab']) => void;
}

const idRegex = '^[a-zA-Z0-9-_]+$';

export function VocabularyEditController(
    $scope: IScope, notify, api, vocabularies, metadata, cvSchema, relationsService, $timeout,
) {
    var origVocabulary = _.cloneDeep($scope.vocabulary);

    $scope.tab = 'general';

    $scope.setTab = function(tab: IScope['tab']) {
        $scope.tab = tab;
    };

    $scope.idRegex = idRegex;
    $scope.selectionTypes = VOCABULARY_SELECTION_TYPES;

    function closeVocabulary(callback?) {
        $scope.closeVocabulary();

        // update items after react editing component has closed
        // to prevent it from throwing an error due to not being able to generate a key
        // which is generated from the position of the item in the array
        if (callback != null) {
            setTimeout(callback);
        }
    }

    if ($scope.matchFieldTypeToTab('related-content-fields', $scope.vocabulary.field_type)) {
        // Insert default allowed workflows
        if ($scope.vocabulary.field_options == null) {
            $scope.vocabulary.field_options = {allowed_workflows: relationsService.getDefaultAllowedWorkflows()};
        } else if ($scope.vocabulary.field_options.allowed_workflows == null) {
            $scope.vocabulary.field_options.allowed_workflows = relationsService.getDefaultAllowedWorkflows();
        }
    }

    function onSuccess(result) {
        notify.success(gettext('Vocabulary saved successfully'));

        closeVocabulary(() => {
            $scope.updateVocabulary(result);
            $scope.issues = null;
            $scope.$apply();
        });
    }

    function onError(response) {
        if (angular.isDefined(response.data._issues)) {
            if (angular.isDefined(response.data._issues['validator exception'])) {
                notify.error(gettext('Error: ' +
                                     response.data._issues['validator exception']));
            } else if (angular.isDefined(response.data._issues.error) &&
                       response.data._issues.error.required_field) {
                let params = response.data._issues.params;

                notify.error(gettext(
                    'Required {{field}} in item {{item}}', {field: params.field, item: params.item}));
            } else {
                $scope.issues = response.data._issues;
                notify.error(gettext('Error. Vocabulary not saved.'));
            }
        }
    }

    function checkForUniqueValues() {
        const uniqueField = $scope.vocabulary.unique_field || 'qcode';
        const list = $scope.vocabulary.items || [];

        if (list.find((item) => uniqueField in item)) {
            const uniqueList = _.uniqBy(list, (item) => item[uniqueField]);

            return list.length === uniqueList.length;
        }
        return true;
    }

    /**
     * Save current edit modal contents on backend.
     */
    $scope.save = function() {
        $scope._errorUniqueness = false;
        $scope.errorMessage = null;
        delete $scope.vocabulary['_deleted'];

        if ($scope.vocabulary._id === 'crop_sizes') {
            var activeItems = _.filter($scope.vocabulary.items, (o) => o.is_active);

            activeItems.forEach(({width, height, name}: any) => {
                if (parseInt(height, 10) < 200 || parseInt(width, 10) < 200) {
                    $scope.errorMessage = gettext('Minimum height and width should be greater than or equal to 200');
                }

                if (!name || name.match(idRegex) === null) {
                    $scope.errorMessage =
                        gettext('Name field should only have alphanumeric characters, dashes and underscores');
                }
            });
        }

        if (!checkForUniqueValues()) {
            const uniqueField = $scope.vocabulary.unique_field || 'qcode';

            $scope.errorMessage = gettext('The values should be unique for {{uniqueField}}', {uniqueField});
        }

        if ($scope.vocabulary.field_type === MEDIA_TYPES.GALLERY.id) {
            const allowedTypes = $scope.vocabulary.field_options.allowed_types;

            Object.keys(allowedTypes).forEach((key) => {
                if (!['picture', 'video', 'audio'].includes(key)) {
                    allowedTypes[key] = false;
                }
            });
        }

        if (_.isNil($scope.errorMessage)) {
            api.save(
                'vocabularies',
                $scope.vocabulary,
                undefined,
                undefined,
                undefined,
                {skipPostProcessing: true},
            ).then(onSuccess, onError);
        }

        // discard metadata cache:
        metadata.loaded = null;
        metadata.initialize();
    };

    /**
     * Return true if at least one content type should be selected
     */
    $scope.requireAllowedTypesSelection = function() {
        if (!MEDIA_TYPE_KEYS.includes($scope.vocabulary.field_type)) {
            return false;
        }

        if ($scope.vocabulary.field_options == null || $scope.vocabulary.field_options.allowed_types == null) {
            return true;
        }

        const allowedTypes = $scope.vocabulary.field_options.allowed_types;
        const selectedKeys = Object.keys(allowedTypes).filter((key) => allowedTypes[key] === true);

        return selectedKeys.length === 0;
    };

    /**
     * Discard changes and close modal.
     */
    $scope.cancel = function() {
        closeVocabulary(() => {
            $scope.updateVocabulary(origVocabulary);
            $scope.$apply();
        });
    };

    // try to reproduce data model of vocabulary:
    var model = _.mapValues(_.keyBy(
        _.uniq(_.flatten(
            _.map($scope.vocabulary.items, (o) => _.keys(o)),
        )),
    ), () => null);

    $scope.model = model;
    $scope.schema = $scope.vocabulary.schema || cvSchema[$scope.vocabulary._id] || null;

    if ($scope.schema) {
        $scope.schemaFields = Object.keys($scope.schema)
            .sort()
            .map((key) => angular.extend(
                {key: key},
                $scope.schema[key],
            ));
    }

    $scope.schemaFields = $scope.schemaFields
        || Object.keys($scope.model)
            .filter((key) => key !== 'is_active')
            .map((key) => ({key: key, label: key, type: key}));

    $scope.newItemTemplate = {...$scope.model, is_active: true};

    $scope.itemsValidation = {valid: true};

    $scope.setFormDirty = () => {
        $scope.editForm.$setDirty();
        $scope.$apply();
    };

    const fields = getFields();

    $scope.customFieldTypes = Object.keys(fields).map((id) => ({
        id: id,
        label: fields[id].label,
    }));

    $scope.setCustomFieldConfig = (config) => {
        $scope.vocabulary.custom_field_config = config;
        $scope.editForm.$setDirty();
        $scope.$apply();
    };
}
