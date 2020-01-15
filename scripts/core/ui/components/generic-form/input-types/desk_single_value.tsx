import {IDesk} from 'superdesk-api';
import {getSelectSingleValueAutoComplete} from './select_single_value_autocomplete';
import {gettext} from 'core/utils';
import {dataApi} from 'core/helpers/CrudManager';

export const DeskSingleValue = getSelectSingleValueAutoComplete(
    (searchString: string) => dataApi.query<IDesk>(
        'desks',
        1,
        {field: 'name', direction: 'ascending'},
        (
            searchString.length > 0
                ? {
                    $or: [
                        {
                            [this.props.sort.field]: {
                                $regex: searchString,
                                $options: '-i',
                            },
                        },
                    ],
                }
                : {}
        ),
        50,
    ),
    gettext('Select a desk'),
    (item: IDesk) => item.name,
);
