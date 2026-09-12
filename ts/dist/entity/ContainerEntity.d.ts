import { PlaystationStoreApi2EntityBase } from '../PlaystationStoreApi2EntityBase';
import type { PlaystationStoreApi2SDK } from '../PlaystationStoreApi2SDK';
import type { Control } from '../types';
import type { Container, ContainerLoadMatch } from '../PlaystationStoreApi2Types';
declare class ContainerEntity extends PlaystationStoreApi2EntityBase<Container> {
    constructor(client: PlaystationStoreApi2SDK, entopts: any);
    make(this: ContainerEntity): ContainerEntity;
    load(this: any, reqmatch?: ContainerLoadMatch, ctrl?: Control): Promise<ContainerEntity>;
}
export { ContainerEntity };
