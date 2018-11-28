import {IArticle} from 'superdesk-interfaces/Article';

RelationsService.$inject = ['archiveService', 'api'];

export function RelationsService(archiveService, api) {
    this.getRelatedItems = function(item: IArticle) {
        if (!item.associations) {
            return [];
        }

        const related = Object.values(item.associations);
        const relatedWithoutNull = related.filter((o) => o !== null);
        const relatedWithoutMedia = relatedWithoutNull.filter((o) => o.type === 'text');
        const unpublished = relatedWithoutMedia.filter((o) => !archiveService.isPublished(o));

        return unpublished;
    };

    this.getRelatedKeys = function(item: IArticle, fieldId: string) {
        return Object.keys(item.associations || {})
            .filter((key) => key.startsWith(fieldId) && item.associations[key] != null)
            .sort();
    };

    this.getRelatedItemsForField = function(item: IArticle, fieldId: string) {
        const associationKeys = this.getRelatedKeys(item, fieldId);

        return Promise.all<IArticle>(
            associationKeys.map((key) => api.find('archive', item.associations[key]._id)),
        )
            .then((items: Array<IArticle>) => {
                return items.reduce((obj, relatedItem, index) => {
                    obj[associationKeys[index]] = relatedItem;
                    return obj;
                }, {});
            });
    };
}
